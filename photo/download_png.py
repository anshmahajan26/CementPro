import base64
import json
import urllib.request
import os

mermaid_code = """%%{init: {"flowchart": {"curve": "stepBefore"}}}%%
graph LR
    classDef root fill:#ffffff,stroke:none,color:transparent
    classDef actor fill:#f9f9f9,stroke:#333,stroke-width:2px,rx:20,ry:20,font-weight:bold,color:#000
    classDef usecase fill:#ffffff,stroke:#333,stroke-width:1.5px,rx:15,ry:15,color:#000
    Root[ ]:::root
    M[Manager]:::actor
    O[Operator]:::actor
    Root --- M
    Root --- O
    M1(Data & ML Pipeline Management):::usecase
    M2(Execute AI Demand Forecasting):::usecase
    M3(Simulate & Dispatch Procurement):::usecase
    M4(Evaluate Carbon Sustainability):::usecase
    M5(View KPI Dashboards & Manage Emergencies):::usecase
    M6(Export Analytics Reports):::usecase
    M --- M1
    M --- M2
    M --- M3
    M --- M4
    M --- M5
    M --- M6
    O1(Monitor Daily Delivery Orders):::usecase
    O2(Update Logistics Status):::usecase
    O3(Raise Emergency Alerts):::usecase
    O4(View Mini Operational Forecast):::usecase
    O --- O1
    O --- O2
    O --- O3
    O --- O4
"""

state = {
    "code": mermaid_code,
    "mermaid": "{\n  \"theme\": \"default\"\n}",
    "autoSync": True,
    "updateDiagram": True
}
json_bytes = json.dumps(state).encode('utf-8')
base64_bytes = base64.urlsafe_b64encode(json_bytes)
base64_string = base64_bytes.decode('utf-8')

url = f"https://mermaid.ink/img/{base64_string}?bgColor=white"

req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response, open('use_case_diagram.png', 'wb') as out_file:
        data = response.read()
        out_file.write(data)
    print("Successfully downloaded use_case_diagram.png")
except Exception as e:
    print(f"Error: {e}")
