const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);



const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { log } = require("node:console");
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


async function run() {
     try {
          // await client.connect();

          const database = client.db("petAdoption");
          const petCollection = database.collection("pets");
          const adopterCollection = database.collection("adopters");

          app.get('/pets', async (req, res) => {
               const result = await petCollection.find().toArray();
               res.json(result)
          })

          // pet data added to db
          app.post('/pets', async (req, res) => {
               const petData = req.body;
               const result = await petCollection.insertOne(petData)
               res.json(result)
          })

          app.get('/pets/:id', async (req, res) => {
               const { id } = req.params;
               const result = await petCollection.findOne({ _id: new ObjectId(id) });
               res.json(result)
          })

          // pet name edite api create
          app.patch('/pets/:id', async (req, res) => {
               const { id } = req.params;
               const updatedData = req.body;

               const result = await petCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updatedData }
               )
               res.json(result)
          })

          // pet delete 
          app.delete('/pets/:id', async (req, res) => {
               const { id } = req.params;
               const result = await petCollection.deleteOne({ _id: new ObjectId(id) });
               res.json(result)
          })

          // searching get data
          app.get('/pets', async (req, res) => {
               if (search) {
                    pets = await petCollection.find({
                         title: {
                              $regex: search,
                              $options: "i"
                         },
                    })
               }
          })




          // my listings api create
          app.get('/adopters/:dataId', async (req, res) => {
               const { dataId } = req.params;
               console.log(dataId);
               
               const result = await adopterCollection.find({ dataId: dataId }).toArray();

               console.log(result);
               res.json(result)
          })
          
          
          
          
          // adopters/Boking data
          app.post("/adopters", async (req, res) => {
               const adopterData = req.body;
               const result = await adopterCollection.insertOne(adopterData);
               res.json(result);
          });

          await client.db("admin").command({ ping: 1 });
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