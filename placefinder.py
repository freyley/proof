import requests


def placefinder(lat, lon):
    url1 = "https://geo.fcc.gov/api/census/area?"
    url2 = "https://www.naccho.org/membership/lhd-directory?"
    place = requests.get(url1, params={"lat": lat, "lon": lon})  # In decimal degrees
    pfacts = place.text.split(",")
    cname = pfacts[8].split(":")[1].strip('"')
    cstate = pfacts[10].split(":")[1].strip('"')
    contact = requests.get(url2, params={"searchType": "standard", "lhd-search": cname, "lhd-state": cstate})  # Returns NACCHO county result
    num = contact.text.split("Phone:")[2].split("tel:")[1].split('">')[0]  # This is an abomination but it works
    return cname, cstate, num  # County name, state, and the local health authority phone number

placefinder(34, -111)  # Hard-coded in the coords for Gila, AZ as a test.
