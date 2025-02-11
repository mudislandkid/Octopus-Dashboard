import requests
import sys
import json
from base64 import b64encode

def test_octopus_api(api_key, account_number):
    # Base URL for Octopus Energy API
    base_url = "https://api.octopus.energy/v1"
    
    # Create basic auth header
    auth_string = b64encode(f"{api_key}:".encode('utf-8')).decode('utf-8')
    headers = {
        'Authorization': f'Basic {auth_string}'
    }
    
    try:
        # Test account endpoint
        account_url = f"{base_url}/accounts/{account_number}"
        print(f"\nTesting connection to: {account_url}")
        
        response = requests.get(account_url, headers=headers)
        response.raise_for_status()
        
        # Pretty print the response
        account_data = response.json()
        print("\nConnection successful! Account information:")
        print(json.dumps(account_data, indent=2))
        
        # Extract and display useful information
        if 'properties' in account_data:
            print("\nFound properties:")
            for idx, property in enumerate(account_data['properties'], 1):
                print(f"\nProperty {idx}:")
                
                # Electricity meter points
                if property.get('electricity_meter_points'):
                    print("\n  Electricity Meters:")
                    for point in property['electricity_meter_points']:
                        print(f"    - MPAN: {point.get('mpan', 'N/A')}")
                        print(f"    - Is Export: {point.get('is_export', False)}")
                        if point.get('meters'):
                            for meter in point['meters']:
                                print(f"      Serial Number: {meter.get('serial_number', 'N/A')}")
                
                # Gas meter points
                if property.get('gas_meter_points'):
                    print("\n  Gas Meters:")
                    for point in property['gas_meter_points']:
                        print(f"    - MPRN: {point.get('mprn', 'N/A')}")
                        if point.get('meters'):
                            for meter in point['meters']:
                                print(f"      Serial Number: {meter.get('serial_number', 'N/A')}")
        
    except requests.exceptions.HTTPError as e:
        print(f"\nError: HTTP {e.response.status_code}")
        print(f"Response: {e.response.text}")
    except Exception as e:
        print(f"\nError: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python test_octopus_api.py <api_key> <account_number>")
        sys.exit(1)
    
    api_key = sys.argv[1]
    account_number = sys.argv[2]
    
    test_octopus_api(api_key, account_number) 