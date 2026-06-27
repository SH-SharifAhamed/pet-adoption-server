const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);


const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { log } = require("node:console");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
dotenv.config();

const uri = process.env.MONGODB_URI;
// app.express.json();

const app = express()
const port = process.env.PORT || 5000;

app.use(cors())
app.use(express.json())

const client = new MongoClient(uri, {
     serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
     }
});

const JWKS = createRemoteJWKSet(
     new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
);

const buildPetQuery = (query = {}) => {
     const filters = {};
     const search = query?.search;
     const speciesValues = [];

     if (search) {
          filters.petName = {
               $regex: search,
               $options: "i",
          };
     }

     const species = Array.isArray(query?.species)
          ? query.species
          : query?.species
               ? String(query.species).split(",").map((item) => item.trim()).filter(Boolean)
               : [];

     const category = Array.isArray(query?.category)
          ? query.category
          : query?.category
               ? String(query.category).split(",").map((item) => item.trim()).filter(Boolean)
               : [];

     speciesValues.push(...species, ...category);

     if (speciesValues.length > 0) {
          filters.category = {
               $in: [...new Set(speciesValues)],
          };
     }

     return filters;
};

// verify token function create for protected route create 
const verifyToken = async (req, res, next) => {
     const authHeader = req?.headers.authorization;

     if (!authHeader) {
          return res.status(401).send({ message: "unauthorized access" });
     }

     const token = authHeader.split(" ")[1];
     if (!token) {
          return res.status(401).send({ message: "unauthorized access" });
     }

     try {
          const { payload } = await jwtVerify(token, JWKS);
          const userId = payload?.sub || payload?.user?.id || payload?.id;
          
          req.user = {
               id: userId,
               email: payload?.email || payload?.user?.email,
               payload,
          };
          next();
     } catch (error) {
          return res.status(401).send({ message: "Forbidden access" });
     }
}


async function run() {
     try {
          // await client.connect();

          const database = client.db("petAdoption");
          const petCollection = database.collection("pets");
          const adopterCollection = database.collection("adopters");

          app.get('/pets', async (req, res) => {
               try {
                    const query = buildPetQuery(req.query);
                    const result = await petCollection.find(query).sort({ _id: -1 }).toArray();
                    res.json(result);
               } catch (error) {
                    console.error(error);
                    res.status(500).json({ message: 'Server error' });
               }
          })


          // pet data added to db
          app.post('/pets', verifyToken, async (req, res) => {
               const petData = req.body;
               petData.userId = req.user?.id;
               petData.ownerEmail = req.user?.email || petData.ownerEmail;
               const result = await petCollection.insertOne(petData)
               res.json(result)
          })

          // get pets added by the authenticated user
          app.get('/pets/my', verifyToken, async (req, res) => {
               const userId = req.user?.id;
               if (!userId) {
                    return res.status(401).json({ message: 'unauthorized access' });
               }
               const result = await petCollection.find({ userId }).sort({ _id: -1 }).toArray();
               res.json(result);
          });

          app.get('/pets/:id/requests', verifyToken, async (req, res) => {
               const { id } = req.params;
               const pet = await petCollection.findOne({ _id: new ObjectId(id) });

               if (!pet) {
                    return res.status(404).json({ message: 'Pet not found' });
               }

               if (pet.userId !== req.user?.id) {
                    return res.status(403).json({ message: 'Only the pet owner can view requests' });
               }

               const result = await adopterCollection.find({ petId: id }).sort({ _id: -1 }).toArray();
               res.json(result);
          });

          // pet single data get api create with verify token
          app.get('/pets/:id', verifyToken, async (req, res) => {
               const { id } = req.params;
               const result = await petCollection.findOne({ _id: new ObjectId(id) });
               res.json(result)
          })

          // pet name edit api create
          app.patch('/pets/:id', verifyToken, async (req, res) => {
               const { id } = req.params;
               const updatedData = req.body;
               const existingPet = await petCollection.findOne({ _id: new ObjectId(id) });

               if (!existingPet) {
                    return res.status(404).json({ message: 'Pet not found' });
               }

               if (existingPet.userId !== req.user?.id) {
                    return res.status(403).json({ message: 'Only the pet owner can update this pet' });
               }

               updatedData.userId = req.user?.id;
               updatedData.ownerEmail = req.user?.email || existingPet.ownerEmail;
               const result = await petCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updatedData }
               )
               res.json(result)
          })

          // pet delete 
          app.delete('/pets/:id', verifyToken, async (req, res) => {
               const { id } = req.params;
               const existingPet = await petCollection.findOne({ _id: new ObjectId(id) });

               if (!existingPet) {
                    return res.status(404).json({ message: 'Pet not found' });
               }

               if (existingPet.userId !== req.user?.id) {
                    return res.status(403).json({ message: 'Only the pet owner can delete this pet' });
               }

               const result = await petCollection.deleteOne({ _id: new ObjectId(id) });
               res.json(result)
          })

          // searching get data
          app.get('/searchpets', async (req, res) => {
               try {
                    const query = buildPetQuery(req.query);
                    const result = await petCollection.find(query).sort({ _id: -1 }).toArray();

                    res.json(result);
               } catch (error) {
                    console.error(error);
                    res.status(500).json({ message: "Server error" });
               }
          })

          // my requests api create
          app.get('/adopters/:dataId', verifyToken, async (req, res) => {
               try {
                    const { dataId } = req.params;
                    const result = await adopterCollection.find({ userId: dataId }).toArray();
                    res.json(result)
               } catch (error) {
                    console.error(error);
                    res.status(500).json({ message: "Server error" });
               }
          })

          // adopters/Boking data
          app.post("/adopters", verifyToken, async (req, res) => {
               try {
                    const adopterData = req.body;
                    const petId = adopterData.petId;
                    const userId = req.user?.id;

                    // Check if pet exists
                    const pet = await petCollection.findOne({ _id: new ObjectId(petId) });
                    if (!pet) {
                         return res.status(404).json({ message: 'Pet not found' });
                    }

                    // Prevent pet owners from requesting their own pets
                    if (pet.userId === userId) {
                         return res.status(403).json({ message: 'Pet owners cannot request adoption for their own pets' });
                    }

                    // Prevent requests for already adopted pets
                    if (pet.status === 'Adopted') {
                         return res.status(400).json({ message: 'This pet has already been adopted' });
                    }

                    // Check if user already has a pending request for this pet
                    const existingRequest = await adopterCollection.findOne({
                         petId: petId,
                         userId: userId,
                         status: { $in: ['Pending', 'Approved'] }
                    });

                    if (existingRequest) {
                         return res.status(400).json({ message: 'You already have a pending or approved request for this pet' });
                    }

                    adopterData.userId = userId;
                    adopterData.status = adopterData.status || 'Pending';
                    const result = await adopterCollection.insertOne(adopterData);
                    res.json(result);
               } catch (error) {
                    console.error(error);
                    res.status(500).json({ message: "Server error" });
               }
          });

          app.patch('/adopters/:id', verifyToken, async (req, res) => {
               try {
                    const { id } = req.params;
                    const { status } = req.body;
                    const request = await adopterCollection.findOne({ _id: new ObjectId(id) });

                    if (!request) {
                         return res.status(404).json({ message: 'Request not found' });
                    }

                    const pet = await petCollection.findOne({ _id: new ObjectId(request.petId) });
                    if (!pet) {
                         return res.status(404).json({ message: 'Pet not found' });
                    }

                    if (pet.userId !== req.user?.id) {
                         return res.status(403).json({ message: 'Only the pet owner can manage requests' });
                    }

                    // Update the current request status
                    const result = await adopterCollection.updateOne(
                         { _id: new ObjectId(id) },
                         { $set: { status } }
                    );

                    if (status === 'Approved') {
                         // Mark pet as Adopted
                         await petCollection.updateOne(
                              { _id: new ObjectId(request.petId) },
                              { $set: { status: 'Adopted' } }
                         );

                         // Reject all other pending requests for this pet
                         await adopterCollection.updateMany(
                              {
                                   petId: request.petId,
                                   _id: { $ne: new ObjectId(id) },
                                   status: 'Pending'
                              },
                              { $set: { status: 'Rejected' } }
                         );
                    }

                    res.json(result);
               } catch (error) {
                    console.error(error);
                    res.status(500).json({ message: 'Server error' });
               }
          });

          // Request Card Delete
          app.delete('/adopters/:id', verifyToken, async (req, res) => {
               try {
                    const { id } = req.params;
                    const result = await adopterCollection.deleteOne({ _id: new ObjectId(id) });
                    res.json(result);
               } catch (error) {
                    console.error(error);
                    res.status(500).json({ message: 'Server error' });
               }
          });



          // await client.db("admin").command({ ping: 1 });
          console.log("Pinged your deployment. You successfully connected to MongoDB!");
     } finally {
          // await client.close();
     }
}
run().catch(console.dir);


app.get('/', (req, res) => {
     res.send("server is running")
})

app.listen(port, () => {
     console.log(`Example app listening on port ${port}`)
})