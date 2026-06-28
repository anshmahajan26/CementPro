import base64
import json
import urllib.request
import os

# Mermaid code for the data flow diagram
mermaid_code = """%%{init: {"flowchart": {"curve": "stepBefore"}}}%%
flowchart TD
    classDef box fill:#ffffff,stroke:#333,stroke-width:2px,color:#000,font-family:Arial,rx:2,ry:2
    classDef hide fill:none,stroke:none,color:transparent

    A[Validated CSV Dataset]:::box
    B[FastAPI Microservice]:::box
    C[1. Forecast Output]:::box
    D[Node.js Analytics Engine]:::box
    E[2. Procurement Output]:::box
    F[Node.js Sustainability Engine]:::box

    G[Applies Emission Multipliers]:::box
    H[3. Sustainability Output]:::box
    I[React Dashboard UI]:::box

    A --> B
    B -- Predicts --> C
    C --> D
    D -- Applies Density Ratio --> E
    E --> F

    F --> G
    G --> H
    H --> I

    %% Force alignment
    E ~~~ G
    D ~~~ H
    C ~~~ I
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
    with urllib.request.urlopen(req) as response, open('data_flow_diagram.png', 'wb') as out_file:
        data = response.read()
        out_file.write(data)
    print("Successfully downloaded data_flow_diagram.png")
except Exception as e:
    print(f"Error: {e}")
