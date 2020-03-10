# proof
For work on the initial GPS epidemic modelling.

Geolife Data Format:

	Each Geolife data file (called a trajectory) has 6 header lines.

	Data is comma separated.

	Each line contains: a latitude, a longitude, a zero, a floating point time in days since the start of the 1900s, and a conventionally written date.

	Each of the 182 humans tracked in the dataset has multiple trajectories, all located in the same directory.


NASA data format:

There are 8 total files in the dataset, corresponding to 8 parts of the world. Latitude is split along the equator, while longitude is split at the prime meridian, and then in half again.

Each file has 10800 by 10800 entries, with each entry covering a square of about 1 km x 1 km.

Data is space separated.

Each entry represents a population density; negative numbers (specifically -9999) imply that there is no data for the given square.

Grids:

The model uses two grids, grid A and grid B. Squares on each grid are the same size as squares in the NASA dataset. 

Grid A’s squares exactly map onto squares in the NASA dataset, while grid B’s squares are shifted half a square south and half a square east. Each square in grid A thus overlaps with 4 squares in grid B.

Humans in a square in grid A are evenly split among the overlapping squares in grid B, +/- one human if the number of humans is not divisible by 4.







Humans:
	
	Currently, humans are generated in two ways: either from the Geolife dataset or from the NASA dataset.

	Humans generated from the NASA dataset represent background population. They remain stationary.

	Humans generated from the Geolife dataset move according to their trajectories, moving to the latitude and longitude in each line as time passes the time the previous line was recorded.

	Human age is generated from a normal distribution. Older humans are more likely to die of the virus, while younger humans are slightly more likely to spread the virus.

Every timestep, humans that are infected have a chance to spread the infection to other humans in their square. Interactions between those humans are registered, and the virus has a chance of spreading. When the Bluetooth app is implemented, these interactions will only register if two users’ Bluetooth devices are close enough to each other.

Each interaction generates a random number, that both humans in the interaction store. A human can check if they’ve interacted with anyone infected by comparing the random numbers in their own history with those in the database of interactions that contain known infectees.

Each infected human has an attached probability of actually having the virus. CDC-confirmed cases have a probability of 1, and probability decays as humans have more degrees of separation from CDC-confirmed cases.

 Humans can now be marked as using the app. If the probability of infection of a human using the app rises too high, they will quarantine themselves, isolating themselves from other humans.

	
Map Section:
	
	Currently the map is taken from Google Maps using the Google Maps Static API.  The API takes a centre coordinate and an integer zoom level; the image is then trimmed into the correct coordinates to cover just the simulation.

	If the simulation isn’t working for you, it’s likely that the API key is missing or broken.

