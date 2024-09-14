

import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async(req, _, next) => {
    if((req.cookies && req.cookies.accessToken) || (req.headers && (req.headers.Authoziration)))
    {
        const token = req.cookies.accessToken || req.headers.Authoziration.replace("Bearer","");
        if (!token) {
            throw new ApiError(401, "Unauthorized request");
        }
    
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        if(!decodedToken){
            throw new ApiError(401,"Invalid tokens decoded"); 
        }
        const user = await User.findById(decodedToken._id).select("-password -refreshToken");
        if (!user) {
            
            throw new ApiError(401, "Invalid Access Token")
        }
        req.user = user;
        next();
    }
    else{
        throw new ApiError(401,"Invalid tokens");
    }
})