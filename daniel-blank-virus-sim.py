import os
import random
import shutil
import requests
import math
from PIL import Image, ImageOps

# Four of the functions were taken from this guy:  enough that I feel I should give him at least some credit.
# Author:   Klokan Petr Pridal, klokan at klokan dot cz
# Web:      http://www.klokan.cz/projects/gdal2tiles/

# Sim parameters
length_of_sim = 100  # How many timesteps the simulation is.
timestep_size = .00001157  # How long each timestep is (here, a second)
grid_size = 300  # How many squares on a side the grid has.
min_lat = 39  # Lowest possible latitude
max_lat = 40.6  # Highest possible latitude
min_lon = 116  # Lowest possible longitude
max_lon = 117  # Highest possible longitude
lat_step = (max_lat - min_lat)/grid_size #how much latitude a cell in the grid covers. The granularity of the grid determines the virus's spread distance.
lon_step = (max_lon - min_lon)/grid_size #how much longitude a cell in the grid covers


#Virus parameters:

spread_prob = .22 #Probability that someone within the infection distance and time of someone infected catches the virus themselves.
spread_time = 60 * .00001157 #Time in seconds across which the infection can spread. This is person-to-person. Do we even need this? TODO: model indirect spread, maybe change units?
incubation_time = 14 #Time in days from infection to contagiousness. Here, it is set to 2 weeks.
fatality_rate = .02 #probability that the virus is lethal
infection_duration = 14 #Time in days from contagiousness to death/recovery.
immunity = .77 #Probability of immunity if someone recovers when the duration ends.

#grid setup
gridA = []
gridB = []
riskGrid = []

for i in range(grid_size):
    gridA.append([])
    gridB.append([])
    riskGrid.append([])
    for j in range(grid_size):
        gridA[i].append([]) #each cell in the grid is a (possibly empty) list of humans.
        gridB[i].append([])
        riskGrid[i].append([0])

"""
This function takes a latitude and longitude, and converts it to two sets of two grid indices, one per grid, which it returns.
"""
def gridify(lat, lon):
    if lat < min_lat:
        latIndexA = 0
        latIndexB = 0
    elif lat > max_lat:
        latIndexA = grid_size - 1
        latIndexB = grid_size - 1
    else:
        latIndexA = int((lat - min_lat)/lat_step)
        latIndexB = int((lat - (min_lat - .5 * lat_step)) / lat_step)
        if latIndexB >= grid_size:
            latIndexB = grid_size - 1
    if lon < min_lon:
        lonIndexA = 0
        lonIndexB = 0
    elif lon > max_lon:
        lonIndexA = grid_size - 1
        lonIndexB = grid_size - 1
    else:
        lonIndexA = int((lon - min_lon) / lon_step)
        lonIndexB = int((lon - (min_lon - .5 * lon_step)) / lon_step)
        if lonIndexB >= grid_size:
            lonIndexB = grid_size - 1
    return ((latIndexA, lonIndexA), (latIndexB, lonIndexB))

"""
A Human. Corresponds to a set of a single person's trajectories in the Geolife dataset.
Humans can become infected, and step to a time: they move to their position at that time, and their incubation or infection timers decrease, making them die or recover accordingly.
TODO: possibly have humans carry probabilities of infection? How do you implement that, since differing incubation times are a thing?
"""
class Human(object):

    def __init__(self, filepath):
        self.filepath = filepath
        self.infected = False #Humans start healthy
        self.incubationLeft = -1
        self.infectionLeft = -1
        self.trajectories = [filepath + "/" + traj for traj in os.listdir(filepath)] #all this human's trajectories
        self.trajectories.sort() #hopefully the timestamps sort to chronological order
        self.trajectoryIterator = iter(self.trajectories)
        self.currTrajectory = open(next(self.trajectoryIterator))
        for i in range(6):
            self.currTrajectory.readline()
        self.posData = self.currTrajectory.readline().split(",")
        self.lat = float(self.posData[0])
        self.lon = float(self.posData[1])
        self.alt = float(self.posData[3])
        self.time = float(self.posData[4])
        self.alive = True
        self.immune = False
        self.gridIndexA, self.gridIndexB = gridify(self.lat, self.lon)
        gridA[self.gridIndexA[0]][self.gridIndexA[1]].append(self)
        gridB[self.gridIndexB[0]][self.gridIndexB[1]].append(self)


    def stepTo(self, time): #find this person's position at the given time. Time has been discretized, with timestep parameters set globally above.
        if(not self.alive):
            return
        while(time > self.time):
            gridA[self.gridIndexA[0]][self.gridIndexA[1]].remove(self)
            gridB[self.gridIndexB[0]][self.gridIndexB[1]].remove(self)
            posData = self.currTrajectory.readline()
            if(posData == ""): #finished this trajectory. Going to next one.
                nextTrajectoryPath = next(self.trajectoryIterator, None)
                if(nextTrajectoryPath == None):
                    self.alive = False
                    return # end of all trajectories. Tentatively, this human simply disappears off the face of the earth.
                self.currTrajectory = open(nextTrajectoryPath)
                for i in range(6):
                    self.currTrajectory.readline()
                posData = self.currTrajectory.readline()
            posData = posData.split(",")
            self.lat = float(posData[0])
            self.lon = float(posData[1])
            self.alt = float(posData[3])
            self.time = float(posData[4])
            self.posData = posData
            self.gridIndexA, self.gridIndexB = gridify(self.lat, self.lon)
            gridA[self.gridIndexA[0]][self.gridIndexA[1]].append(self)
            gridB[self.gridIndexB[0]][self.gridIndexB[1]].append(self)


            if(self.infected):
                riskGrid[self.gridIndexA[0]][self.gridIndexA[1]][0] = riskGrid[self.gridIndexA[0]][self.gridIndexA[1]][0]+1 # This first line increments the risk map every time an infected human is in the grid square
                if(self.incubationLeft > 0): #assumes timesteps are small enough that overcounting is negligible
                    self.incubationLeft -= (time - self.time)
                elif(self.infectionLeft > 0):
                    self.infectionLeft -= (time - self.time)
                else:
                    if random.random() < fatality_rate:
                        self.alive = False
                        gridA[self.gridIndexA[0]][self.gridIndexA[1]].remove(self)
                        gridB[self.gridIndexB[0]][self.gridIndexB[1]].remove(self)
                        return
                    if random.random() < immunity:
                        self.immune = True
                        self.infected = False
                    else:
                        self.infected = False
                        self.incubationLeft = -1
                        self.infectionLeft = -1



            self.time = time

    def infect(self):
        if(self.alive and not self.infected):
            self.infected = True
            self.infectionLeft = infection_duration
            self.incubationLeft = incubation_time

def episimulation(n): # Sets up and triggers the simulation n times
    for i in range(n):
        #simulation setup
        basePath = r"Geolife Trajectories 1.3\Geolife Trajectories 1.3\Data" #path to the data of all humans
        humanPaths = os.listdir(basePath)
        humans = []
        for path in humanPaths:
            humans.append(Human(basePath + "/" + path + "/" + "Trajectory"))
            humans[len(humans) - 1].stepTo(humans[0].time) #start at the starting time of the first human.
        currTime = humans[0].time
        startTime = currTime
        humans[int(len(humans) * random.random())].infect() #infect a human at random



        #main simulation loop
        while(currTime < startTime + length_of_sim * timestep_size):
            currTime += timestep_size
            [h.stepTo(currTime) for h in humans] #step to a specific time, decrementing timers accordingly
            for transmitter in humans:
                if transmitter.infected and transmitter.incubationLeft <= 0: #model spread of the virus to nearby humans
                    for h in gridA[transmitter.gridIndexA[0]][transmitter.gridIndexA[1]]:
                        if h != transmitter:
                            h.infect()
                    for h in gridB[transmitter.gridIndexB[0]][transmitter.gridIndexB[1]]:
                        if h != transmitter:
                            h.infect()


episimulation(10)  # Run the simulation n times, with the cumulative risk going into riskGrid
"""
for row in gridA:
    print([[h.infected for h in cell] for cell in row])
print([(h.lat, h.lon) for h in humans])
# This section outputs a grid showing where everyone (infected or uninfected) is at the end of the sim, with their GPS coordinates.
"""

# This next section finds the highest risk score of any grid square and converts them to log10
riskiest = 0
for i in range(grid_size):
    for j in range(grid_size):
        if riskGrid[i][j][0] > 0:
            riskGrid[i][j][0] = math.log10(riskGrid[i][j][0])
            if riskGrid[i][j][0] > riskiest:
                riskiest = riskGrid[i][j][0]

# This part linearly scales the risk value from 0 to 255 (for easy colour conversion)
for i in range(grid_size):
    for j in range(grid_size):
        riskGrid[i][j][0] = int(riskGrid[i][j][0]/(riskiest+1)*255)

url = "https://maps.googleapis.com/maps/api/staticmap?"
# ^Requires center, zoom, and size parameters as as well as an API key.
# If you don't have a copy of the key already, message me at rhys.a.fenwick@gmail.com.

bbox = [[min_lat, min_lon], [max_lat, max_lon]]  # The lat/long coordinates of the box in order [[bottom, left], [top, right]]
# Don't forget: negatives mean SW.  I'm sure there's a hot take in there somewhere about hemisphere bias.

coords = [bbox[0], [bbox[0][0], bbox[1][1]], bbox[1], [bbox[1][0], bbox[0][1]]]  # Four corners of the box

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
avlat = (coords[2][0]+coords[1][0])/2
avlon = (coords[2][1]+coords[3][1])/2
center_coords = MetersToLatLon(avlat, avlon)  # Center point.  Unfortunately, GMaps needs this back as lat/long.
center = str(center_coords[0])+","+str(center_coords[1])

zoom = 0  # There's probably a more elegant way to work this out, but I'm lazy and this is the first that comes to mind.
for i in range(30):
    if Resolution(i)*640 > longest_side:
        zoom = i

# Now that we have zoom and center, we can finally grab the map section we want.
gmap = requests.get(url, params={"size": "640x640", "scale": "2", "zoom": zoom, "center": center, "key": "Message Rhys"}, stream="True")
# Note that a 640x640 image at x2 scale returns a 1280x1280 image.  That was a nightmare to figure out.
mapname = "Initial Map.png"
with open(mapname, 'wb') as f:
    shutil.copyfileobj(gmap.raw, f)

# Working out the size and scaling factor of the map section that we care about
grid_width = sides[0]
grid_height = sides[1]
map_size = Resolution(zoom)
section_height = grid_height/map_size
section_width = grid_width/map_size
map_scaling_height = section_height/grid_size
map_scaling_width = section_width/grid_size

# Graphics time!
img = Image.new('RGBA', (grid_size,grid_size), color=(255, 255, 255, 0))  # Sets up a grid the size of the simulation
px = img.load()
for i in range(grid_size):
    for j in range(grid_size):
        if riskGrid[i][j][0] != 0:
            px[j, i] = ((255, riskGrid[i][j][0], riskGrid[i][j][0], 128))
img = img.resize(size=(int(2*grid_size*map_scaling_width), int(2*grid_size*map_scaling_height)))
img = ImageOps.flip(img)  # To account for the fact that the image measures y-values from the top.

background = Image.open("Initial Map.png").convert("RGBA")
background = ImageOps.fit(background, size=img.size, centering=(0.5, 0.5))
Image.alpha_composite(background, img).save("Final Heatmap.png")
