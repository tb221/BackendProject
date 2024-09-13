import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary }  from "../utils/cloudinary.js";


const registerUser = asyncHandler(async(req,res)=>{
    const { email,password,fullName,username } = req.body;
    if([email,password,fullName,username].some((field)=>(field?.trim() === "")))
    {
        throw new ApiError(400, "All fields are required");
    } 
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists");
    }
    //console.log(req.files);  //Middleware(multer middleware) will inject files in request
    let avatarLocalPath;
    if(req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0)
    {
        avatarLocalPath = req.files.avatar[0].path;
      
    }
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0)
    {
        coverImageLocalPath = req.files.coverImage[0].path;
    }
   
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }
   
    const avatar =  await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    
    if(!avatar){
        throw new ApiError(400, "Avatar file is required not uplaoded");
    }
    const user = await User.create({
        fullName:fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email:email, 
        password:password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user");
    }
    //console.log(createdUser);
    return res.status(201).json(
        
        new ApiResponse(201, createdUser, "User registered Successfully")
       
    );


})

export { registerUser  };