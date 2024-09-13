
import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { error } from "console";
import app from "./app.js";

dotenv.config({
    path:'./.env'
});

const Port = process.env.Port || 3000;

connectDB()
.then(()=>{
    app.listen(Port,(()=>{
        console.log(`Server is listening on ${Port}`);
    }))
})
.catch((err)=>{
    console.log("Mongo DB ERROR: ",error);
});