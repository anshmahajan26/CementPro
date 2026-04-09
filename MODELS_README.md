# Smart RMC ML & Analytics Documentation

This documentation provides an in-depth explanation of the models and logic used in the Smart Ready-Mix Concrete (RMC) forecasting project.

---

## 1. The ML Demand Forecasting Model

The core engine of this platform is the **Demand Forecasting Model**, which predicts the required volume of Ready-Mix Concrete in cubic meters ($m^3$) for future days.

### Which Hybrid Model is Used Here?
The system utilizes an **Automated Tournament (Selection) Hybrid Approach**. Instead of locking into a single algorithm, the ML API trains three separate models simultaneously on your historical dataset:

1. **XGBoost (Extreme Gradient Boosting):** Excellent at capturing non-linear relationships between variables (like cement ratio, slump, and day in project) and the final demand without overfitting.
2. **LSTM (Long Short-Term Memory Neural Network):** A sequence-based deep learning model powered by TensorFlow. It excels at recognizing time-series patterns (e.g., weekly cycles of concrete pouring).
3. **Linear Regression:** A baseline model to capture straightforward upward or downward project trends.

**How it works:**
When you trigger a training cycle, the system evaluates all three models in parallel against an 80/20 train-test split. It calculates the **RMSE (Root Mean Square Error)** for each. The model with the lowest error wins the tournament and is automatically deployed as the `best_model`. When the backend requests a forecast, it routes the request specifically through the winning algorithm to ensure the highest accuracy.

---

## 2. The Procurement Model

The Procurement Model is a deterministic analytics engine (not ML, but heavily mathematical) hosted on the Node.js backend (`analyticsService.js`). 

**How it works:**
1. It takes the output from the ML Forecast model (e.g., "Tomorrow we need 1500 $m^3$ of RMC").
2. It looks at the **Historical Averages** of your mix designs (e.g., how much Cement, Aggregate, and Water has been historically required per $m^3$).
3. It multiplies the forecasted volume by these density ratios to generate exact procurement weights. 

*Example:* If the ML predicts 1,000 $m^3$ of RMC is needed tomorrow, and the historical mix requirement is $350$ kg/m³ of cement, the Procurement Model calculates: 
`1,000 m³ * 350 kg/m³ = 350,000 kg (or 350 Tonnes)` of cement needed.

---

## 3. The Carbon Emission (Sustainability) Model

Like procurement, the Carbon Model is an analytical calculator based on industry-standard emission factors.

**How it works:**
1. It receives the calculated tonnages from the Procurement Model (Cement, Aggregates, Water).
2. It applies specialized multipliers (e.g., Cement usually emits ~0.8 to 0.9 kg of $CO_2$ per 1 kg produced).
3. It calculates transport emissions based on anticipated `transport_time_min` and simulated distance.
4. It aggregates these figures into a **Total Emission Value ($kgCO_2$)** and generates a **Sustainability Score** out of 100 based on how efficient the mix and transport are forecasted to be.

---

## 4. Recommended Charts & Dashboards for the User

To make this complex data easily digestible for site managers and procurement officers, the frontend dashboard should implement the following visualizations (likely using a library like **Recharts** or **Chart.js**):

### A. The Core KPI Cards (At the Top)
* **Predicted Demand:** Large, bold number showing tomorrow's required volume in $m^3$.
* **Cement Required:** Tons of cement needed to be ordered today.
* **Estimated Carbon:** The $CO_2$ footprint of the next pour.
* **Sustainability Score:** A colored badge (Green > 80, Yellow > 60, Red < 60) showing operational efficiency.

### B. Predictive Demand Trend (Line Chart)
* **What to show:** A line chart plotting the last 7 days of *Actual Demand* (Solid Line) blending seamlessly into the next 7 days of *Predicted Demand* (Dashed/Dotted Line). 
* **Why:** Helps the user visualize the trajectory of the pour. Include a shaded area representing the "Confidence Interval" if applicable.

### C. Materials Inventory Breakdown (Stacked Bar Chart or Donut Chart)
* **What to show:** The volume of Cement vs. 10mm Aggregate vs. 20mm Aggregate vs. Water required for the forecasted period.
* **Why:** Procurement officers need to know the ratio to manage silos and stockpile sizes efficiently.

### D. Transport vs Efficiency (Scatter Plot or Dual-Axis Line)
* **What to show:** Plot `transport_time_min` against `daily_rmc_volume_m3`.
* **Why:** Quickly identifies logistical bottlenecks. If transport time spikes when volume goes up, fleet managers know they need to hire more transit mixers.

### E. AI Insights Panel (Text & Alerts)
* **What to show:** Short, generated sentences like: *"Demand is expected to rise by 15% on Thursday. Ensure 450 Tonnes of cement are procured by Wednesday afternoon."* Let the system summarize the charts natively.
* **Feature Importance Chart:** A simple Horizontal Bar Chart showing which factors (e.g., `day_in_project`, `project_size`) are driving the AI model's current predictions.
