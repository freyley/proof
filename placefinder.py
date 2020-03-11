import requests


def placefinder(lat, lon):
    url = "https://geo.fcc.gov/api/census/area?"
    place = requests.get(url, params={"lat": lat, "lon": lon})  # In decimal degrees
    pfacts = place.text.split(",")
    fips = pfacts[7].split(":")[1].strip('"')
    f = open("Counties.txt", "r")
    clist = f.read().split("\n")
    dlist = []
    for i in clist:
        dlist.append(i.split(","))
    for i in dlist:
        if i[0] == str(fips):
            print("It looks like you're in "+i[1]+", "+i[2]+".")
            if i[3] == "!NONUM":
                print("Unfortunately we can't seem to find the phone number for your local health authority.")
            else:
                print("The phone number for your local health authority is"+i[3]+".")


placefinder(34, -111)  # Hard-coded in the coords for Gila, AZ as a test.
