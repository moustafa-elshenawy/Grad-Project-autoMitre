import requests

url = "http://localhost:8000/api/analyze/extract-attacks"
file_path = "test_sqli.pcap"

with open(file_path, "rb") as f:
    files = {"file": f}
    response = requests.post(url, files=files)

print("Status:", response.status_code)
print("Response:", response.json())
