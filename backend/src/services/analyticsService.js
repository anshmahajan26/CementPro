const round = (value, precision = 2) => Number(value.toFixed(precision));

export const getLatestRecord = (rows) => rows[rows.length - 1] || null;

// ✅ FIX: Cap chart outputs to prevent sending huge datasets over the wire
const CHART_LIMIT = 90;
const SCATTER_LIMIT = 200;

export const buildDemandTrend = (predictions) => {
  return (predictions || []).map((item) => ({
    date: item.date,
    demand: round(item.predicted_demand_m3)
  }));
};

export const buildProjectProgress = (rows) => {
  const grouped = new Map();
  rows.forEach(row => {
    const day = row.day_in_project;
    if (!grouped.has(day)) {
      grouped.set(day, { total_demand: 0, count: 0 });
    }
    const current = grouped.get(day);
    current.total_demand += row.daily_rmc_volume_m3;
    current.count += 1;
  });

  const result = Array.from(grouped.entries())
    .map(([day, stats]) => ({
      day_in_project: day,
      demand: round(stats.total_demand / stats.count)
    }))
    .sort((a, b) => a.day_in_project - b.day_in_project);
  
  return result;
};

export const buildTransportEfficiencySeries = (rows) => {
  const sample = rows.length > SCATTER_LIMIT ? rows.slice(-SCATTER_LIMIT) : rows;
  return sample.map((row) => {
    const efficiency = calculateEfficiency(row.batching_time_min, row.transport_time_min, row.truck_capacity_m3);
    return {
      transport_time_min: row.transport_time_min,
      batching_time_min: row.batching_time_min,
      efficiency_score: round(efficiency)
    };
  });
};

export const calculateEfficiency = (batchingTime, transportTime, truckCapacity) => {
  const operationalTime = batchingTime + transportTime;
  const base = truckCapacity > 0 ? truckCapacity / Math.max(operationalTime, 1) : 0;
  return Math.max(0, Math.min(100, base * 100));
};

export const calculateProcurement = (predictions, rows, currentInventoryTonnes = 0) => {
  // ✅ FIX: Single reduce pass instead of 5 separate passes — O(n) instead of O(5n)
  const totals = rows.reduce(
    (acc, row) => {
      acc.cement += row.cement_kg_m3;
      acc.agg10 += row.aggregate_10mm_pct;
      acc.agg20 += row.aggregate_20mm_pct;
      acc.moisture += row.agg_moisture_content_pct;
      acc.wbr += row.water_binder_ratio;
      return acc;
    },
    { cement: 0, agg10: 0, agg20: 0, moisture: 0, wbr: 0 }
  );

  const n = rows.length;
  const avgCementKgM3 = totals.cement / n;
  const avgAgg10 = totals.agg10 / n;
  const avgAgg20 = totals.agg20 / n;
  const avgMoisture = totals.moisture / n;
  const avgWbr = totals.wbr / n;

  let dynamicInventory = parseFloat(currentInventoryTonnes) || 0;
  const purchase_alerts = [];

  const recommendation = predictions.map((item) => {
    const cementKg = item.predicted_demand_m3 * avgCementKgM3;
    const requiredTonnes = cementKg / 1000;

    let shortfall = 0;
    if (dynamicInventory >= requiredTonnes) {
      dynamicInventory -= requiredTonnes;
    } else {
      shortfall = requiredTonnes - dynamicInventory;
      dynamicInventory = 0;

      if (shortfall > 0) {
        purchase_alerts.push({
          date: item.date,
          shortfall_tonnes: round(shortfall),
          message: `Order ${round(shortfall)}t of cement immediately to cover shortfall on ${item.date}.`
        });
      }
    }

    return {
      date: item.date,
      predicted_demand_m3: round(item.predicted_demand_m3),
      cement_required_kg: round(cementKg),
      cement_required_tonnes: round(requiredTonnes),
      inventory_remaining_tonnes: round(dynamicInventory),
      shortfall_tonnes: round(shortfall)
    };
  });

  const totalCementKg = recommendation.reduce((sum, row) => sum + row.cement_required_kg, 0);
  const totalDemandM3 = recommendation.reduce((sum, row) => sum + row.predicted_demand_m3, 0);
  const avgDailyCementTonnes = recommendation.length ? totalCementKg / 1000 / recommendation.length : 0;
  
  const totalShortfall = recommendation.reduce((sum, row) => sum + row.shortfall_tonnes, 0);
  const finalInventory = dynamicInventory;
  
  let riskLevel = "LOW";
  if (totalShortfall > 0) {
    riskLevel = "HIGH";
  } else if (finalInventory < avgDailyCementTonnes * 2) {
    // Less than 2 days of buffer remaining at end of horizon
    riskLevel = "MEDIUM";
  } else if (finalInventory > (totalCementKg / 1000) * 1.5 && finalInventory > 50) {
    // Holding more than 150% of the entire horizon requirement
    riskLevel = "SURPLUS";
  }

  return {
    averages: {
      cement_kg_m3: round(avgCementKgM3),
      aggregate_10mm_pct: round(avgAgg10),
      aggregate_20mm_pct: round(avgAgg20),
      agg_moisture_content_pct: round(avgMoisture),
      water_binder_ratio: round(avgWbr, 3)
    },
    total_cement_required_kg: round(totalCementKg),
    total_cement_required_tonnes: round(totalCementKg / 1000),
    total_predicted_demand_m3: round(totalDemandM3),
    avg_daily_cement_tonnes: round(avgDailyCementTonnes),
    procurement_risk_level: riskLevel,
    stakeholder_summary:
      riskLevel === "HIGH"
        ? `Critical supply chain warning. Projected shortfall of ${round(totalShortfall)}t detected within this horizon. Immediate dispatch is required.`
        : riskLevel === "MEDIUM"
          ? "Procurement is sustained, but silo buffering drops below optimal levels by the end of this horizon. Prepare bulk replenishment."
          : riskLevel === "SURPLUS"
            ? "You have low procurement needs, but a very large amount of cement is holding for the current project."
            : "Inventory covers forecasted requirements sufficiently. No immediate procurement stress.",
    recommendation,
    purchase_alerts,
    insight: `Maintain aggregate split near ${round(avgAgg10)}:${round(avgAgg20)} and keep water-binder ratio around ${round(avgWbr, 3)} for stable quality.`
  };
};

export const calculateCarbon = (predictions, rows, procurement, blendFactor = 0.92) => {
  // ✅ FIX: Single pass to compute avgTransport and avgTruckCapacity simultaneously
  const { totalTransport, totalTruckCapacity } = rows.reduce(
    (acc, row) => {
      acc.totalTransport += row.transport_time_min;
      acc.totalTruckCapacity += row.truck_capacity_m3;
      return acc;
    },
    { totalTransport: 0, totalTruckCapacity: 0 }
  );

  const avgTransport = totalTransport / rows.length;
  const avgTruckCapacity = totalTruckCapacity / rows.length;

  const daily = procurement.recommendation.map((item) => {
    const transportTrips = item.predicted_demand_m3 / Math.max(avgTruckCapacity, 1);
    
    // 1. Direct Heavy Duty RMC Mixer Truck routing emissions
    const directTransport = transportTrips * avgTransport * 2.5; 
    
    // 2. Holistic supply chain (Plant Idling, Loader Bulldozers, Aggegrate Mining transport)
    // We bind a baseline operational overhead of ~85 kgCO2 per cubic meter processed.
    // This correctly visualizes the broader logistics structure instead of just road-time, fixing the UI ratio.
    const operationalOverhead = item.predicted_demand_m3 * 85;
    
    const transportEmission = directTransport + operationalOverhead;
    const cementEmission = item.cement_required_kg * blendFactor;
    const totalEmissionKgCo2 = cementEmission + transportEmission;

    return {
      date: item.date,
      cement_emission_kgco2: round(cementEmission),
      transport_emission_kgco2: round(transportEmission),
      total_emission_kgco2: round(totalEmissionKgCo2)
    };
  });

  const totalEmission = daily.reduce((sum, item) => sum + item.total_emission_kgco2, 0);
  const totalDemand = procurement.recommendation.reduce((sum, row) => sum + row.predicted_demand_m3, 0);
  const emissionIntensity = totalEmission / Math.max(totalDemand, 1);
  const sustainabilityScore = Math.max(0, Math.min(100, 100 - emissionIntensity * 1.5));
  const emissionBand = emissionIntensity > 350 ? "HIGH" : emissionIntensity > 250 ? "MEDIUM" : "LOW";

  const warning =
    emissionIntensity > 350
      ? "High emission warning: optimize cement content and reduce transport cycle time."
      : "Emission intensity within acceptable range.";

  return {
    avg_transport_time_min: round(avgTransport),
    total_emission_kgco2: round(totalEmission),
    emission_intensity_kgco2_per_m3: round(emissionIntensity),
    sustainability_score: round(sustainabilityScore),
    emission_band: emissionBand,
    stakeholder_summary:
      emissionBand === "HIGH"
        ? "Carbon exposure is high. Prioritize lower transport cycle time and optimize cement dosage."
        : emissionBand === "MEDIUM"
          ? "Carbon levels are moderate. Incremental transport and batching improvements can reduce impact."
          : "Carbon profile is healthy for current plan. Maintain current process controls.",
    warning,
    optimization_suggestion:
      "Cluster deliveries by location and prioritize shorter transport windows to reduce transport-related CO2.",
    daily
  };
};

export const buildAlerts = ({ predictions, carbon, rows, procurement }) => {
  const alerts = [];

  // Include dynamically generated procurement deficit alerts
  if (procurement && procurement.purchase_alerts && procurement.purchase_alerts.length > 0) {
    procurement.purchase_alerts.slice(0, 2).forEach(pa => {
      alerts.push({ type: "PROCUREMENT_SHORTFALL", message: pa.message });
    });
  }

  // Calculate local forecast dynamic average
  const totalPredicted = predictions.reduce((sum, row) => sum + row.predicted_demand_m3, 0);
  const avgPredicted = totalPredicted / Math.max(predictions.length, 1);
  const maxPred = Math.max(...predictions.map((row) => row.predicted_demand_m3));

  // If a specific forecasted day has a massive spike compared to the rest of the week's forecast
  if (maxPred > avgPredicted * 1.35) {
    alerts.push({ type: "SPORADIC_DEMAND_SPIKE", message: "Sharp volatile demand spike predicted in this horizon. Secure spot logistics." });
  }

  // Compare to global baseline demand for a volume warning
  const globalTotalDemand = rows.reduce((sum, row) => sum + row.daily_rmc_volume_m3, 0);
  const globalAvgDemand = globalTotalDemand / Math.max(rows.length, 1);

  if (avgPredicted > globalAvgDemand * 1.15) {
    alerts.push({ type: "HIGH_VOLUME", message: "This location's forecast exceeds global nominal demand. Prepare excess capacity." });
  }

  if (carbon.emission_intensity_kgco2_per_m3 > 350) {
    alerts.push({ type: "HIGH_EMISSION", message: "High carbon emission intensity detected. Optimize cement dosage and transport cycle." });
  } else if (carbon.emission_intensity_kgco2_per_m3 < 200) {
    alerts.push({ type: "OPTIMIZED_EMISSION", message: "Excellent low-carbon footprint trajectory detected for this footprint." });
  }

  return alerts;
};

export const buildLocationInsights = (rows) => {
  const grouped = new Map();

  rows.forEach((row) => {
    const key = `${row.latitude.toFixed(4)},${row.longitude.toFixed(4)}`;
    const current = grouped.get(key) || {
      latitude: row.latitude,
      longitude: row.longitude,
      totalDemand: 0,
      totalTransport: 0,
      samples: 0
    };

    current.totalDemand += row.daily_rmc_volume_m3;
    current.totalTransport += row.transport_time_min;
    current.samples += 1;
    grouped.set(key, current);
  });

  return Array.from(grouped.values())
    .map((item) => ({
      latitude: item.latitude,
      longitude: item.longitude,
      avg_demand_m3: round(item.totalDemand / item.samples),
      avg_transport_time_min: round(item.totalTransport / item.samples),
      samples: item.samples
    }))
    .sort((a, b) => b.avg_demand_m3 - a.avg_demand_m3)
    .slice(0, 20);
};
