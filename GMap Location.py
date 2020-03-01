# Four of the functions were taken from this guy:  enough that I feel I should give him at least some credit.
# Author:   Klokan Petr Pridal, klokan at klokan dot cz
# Web:      http://www.klokan.cz/projects/gdal2tiles/

import shutil
import requests
import math

url = "https://maps.googleapis.com/maps/api/staticmap?"
# ^Requires center, zoom, and size parameters as as well as an API key.
# If you don't have a copy of the key already, message me at rhys.a.fenwick@gmail.com.

bbox = [[39, 116], [40.6, 117]]  # The lat/long coordinates of the box in order [[bottom, left], [top, right]]
# Don't forget: negatives mean SW.  I'm sure there's a hot take in there somewhere about hemisphere bias.
boxsize = [640, 640]  # Pixel size of the final map

coords = [bbox[0], [bbox[0][0], bbox[1][1]], bbox[1], [bbox[1][0], bbox[0][1]]]  # SW\SE\NE\NW corners of the box

originShift = 2 * math.pi * 6378137 / 2.0
initialResolution = 2 * math.pi * 6378137 / 256

def LatLonToMeters(lat, lon):
    "Converts given lat/lon in WGS84 Datum to XY in Spherical Mercator EPSG:900913"

    mx = lon * originShift / 180.0
    my = math.log(math.tan((90 + lat) * math.pi / 360.0)) / (math.pi / 180.0)

    my = my * originShift / 180.0
    return my, mx

def MetersToLatLon(my, mx):
    "Converts XY point from Spherical Mercator EPSG:3857 to lat/lon in WGS84 Datum"

    lon = (mx / originShift) * 180.0
    lat = (my / originShift) * 180.0

    lat = 180 / math.pi * (2 * math.atan(math.exp(lat * math.pi / 180.0)) - math.pi / 2.0)
    return lat, lon

def Resolution(zoom):
    "Resolution (meters/pixel) for given zoom level (measured at Equator)"

    # return (2 * math.pi * 6378137) / (self.tileSize * 2**zoom)
    return initialResolution / (2 ** zoom)

def MetersToPixels(mx, my, zoom):
    "Converts EPSG:900913 to pyramid pixel coordinates in given zoom level"

    res = Resolution(zoom)
    px = (mx + originShift) / res
    py = (my + originShift) / res
    return px, py

for i in range(4):
    coords[i] = LatLonToMeters(coords[i][0], coords[i][1])


sides = [abs(coords[2][1] - coords[3][1]), abs(coords[1][0] - coords[2][0])]  # Top/Side side lengths in EPSG:3857 Coordinates.  Will always be a rectangle.
longest_side = max(sides)  # This determines the zoom level we need
avlat = (coords[0][0]+coords[1][0])/2
avlon = (coords[0][1]+coords[3][1])/2
center_coords = MetersToLatLon(avlat, avlon)  # Center point.  Unfortunately, GMaps needs this back as lat/long.
center = str(center_coords[0])+","+str(center_coords[1])

zoom = 0  # There's probably a more elegant way to work this out, but I'm lazy and this is the first that comes to mind.
for i in range(30):
    if Resolution(i)*640 > longest_side:
        zoom = i

# Now that we have zoom and center, we can finally grab the map section we want.
gmap = requests.get(url, params={"size": "640x640", "scale": "2", "zoom": zoom, "center": center, "key": message rhys}, stream="True")
mapname = "Map of "+str(center_coords)
with open(mapname, 'wb') as f:
    shutil.copyfileobj(gmap.raw, f)

