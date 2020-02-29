import os
import random

#Sim parameters
length_of_sim = 10 #How many timesteps the simulation is.
timestep_size = .00001157 #How long each timestep is (here, a second)
grid_size = 300 #How many squares on a side the grid has.
min_lat = 39 #lowest possible latitude
max_lat = 40.6 #highest possible latitude
min_lon = 116 #lowest possible longitude
max_lon = 117 #highest possible longitude
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
    if lon < min_lon:
        lonIndexA = 0
        lonIndexB = 0
    elif lon > max_lon:
        lonIndexA = grid_size - 1
        lonIndexB = grid_size - 1
    else:
        lonIndexA = int((lon - min_lon) / lon_step)
        lonIndexB = int((lon - (min_lon - .5 * lon_step)) / lon_step)
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
                # Start my meddling
                riskGrid[self.gridIndexA[0]][self.gridIndexA[1]][0] = riskGrid[self.gridIndexA[0]][self.gridIndexA[1]][0]+1
                # End my meddling
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
        if transmitter.infected: #model spread of the virus to nearby humans
            for h in gridA[transmitter.gridIndexA[0]][transmitter.gridIndexA[1]]:
                if h != transmitter:
                    h.infect()
            for h in gridB[transmitter.gridIndexB[0]][transmitter.gridIndexB[1]]:
                if h != transmitter:
                    h.infect()
"""
for row in gridA:
    print([[h.infected for h in cell] for cell in row])

print([(h.lat, h.lon) for h in humans])
# This section outputs a grid showing where everyone (infected or uninfected) is at the end of the sim, with their GPS coordinates.
"""

# This next section converts the raw risk score for each grid box to a linearly scaled score from 0-1.
riskiest = 0
for i in riskGrid:
    for j in i:
        for k in j:
            if k > riskiest:
                riskiest = k
"""
for i in riskGrid:
    for j in i:
        for k in j:
            k = k/riskiest
"""
for i in riskGrid:
    print(i)
print(riskiest)
