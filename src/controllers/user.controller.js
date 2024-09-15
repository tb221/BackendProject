import { fail } from "assert";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteFromCloudinary, uploadOnCloudinary }  from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
/* 

//Another way to Populate accessToken and refreshToken
const generateAccessAndRefereshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}


    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}
*/


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


});

const loginUser = asyncHandler(async (req, res) =>{
    const {email,username,password} = req.body;
    if((email || username) && (password))
    {
        const user = await User.findOne({
            $or : [{username:username},{email:email}]
        });
        //console.log(user);
        if(!user){
            throw new ApiError(401,"Unknown Users");
        }
        const isValidPassword = user.isPasswordCorrect(password);
        if(!isValidPassword){
            throw new ApiError(401,"Inavlid Credentials");
        }
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        //console.log("\n Refresh Token is ",refreshToken);
        //console.log("\n Access Token is",accessToken);
        //console.log(user._id);


        /*


        // This is also a way to update refresh token if user is logged In
        user.refreshToken = refreshToken;
        const userId = user._id;
        await user.save({ validateBeforeSave: false });
        const loggedInUser = await User.findById({_id:userId}).select("-password -refreshToken");

        */
        const loggedInUser = await User.findByIdAndUpdate({_id:user._id},{
                $set:{
                    refreshToken : refreshToken
                },
            },
            {
                new : true
            }
        ).select("-password -refreshToken");
        //console.log(loggedInUser);
        const data = {
            user:loggedInUser,
            accessToken:accessToken,
            refreshToken:refreshToken
        }
        const options = {
            httpOnly : true,
            secure : true
        };
        return res.status(200).
        cookie("accessToken",accessToken,options).
        cookie("refreshToken",refreshToken,options).
        json(
            new ApiResponse(200,
                data,
                "User Logged In Successfully" 
            )
        )
    }
    else{
        throw new ApiError(401,"Required fiels is missing!!!");
    }

});

const logoutUser = asyncHandler(async(req,res)=>{
    const user = req.user;
    user.refreshToken = undefined
    await user.save({ validateBeforeSave : false });
    const options = {
        httpOnly : true,
        secure : true
    };
    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
            
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const accessToken = user?.generateAccessToken();
        const newRefreshToken = user?.generateRefreshToken();
        user.refreshToken = newRefreshToken;
        await user.save({ validateBeforeSave : false });
        const data = {
            accessToken:accessToken,
            refreshToken:newRefreshToken
        };
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200, 
                data,
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})
const changeCurrentPassword = asyncHandler(async(req, res) => {
    const {oldPassword, newPassword} = req.body

    

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})


const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(
        200,
        req.user,
        "User fetched successfully"
    ))
})

const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email} = req.body

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: email
            }
        },
        {new: true}
        
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
});

const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    //TODO: delete old image - assignment
    const avatarUrl = req.user?.avatar;
    await deleteFromCloudinary(avatarUrl);
    
    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
        
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Avatar image updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is missing")
    }

    //TODO: delete old image - assignment
    const coverImageUrl = req.user?.coverImage;
    await deleteFromCloudinary(coverImageUrl);

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on avatar")
        
    }
    
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")
    
    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover image updated successfully")
    )
})

const getUserChannelProfile = asyncHandler(async(req, res) => {
    const {username} = req.params

    if (!username?.trim()) {
        throw new ApiError(400, "username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1

            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404, "channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})





export {    registerUser, 
            loginUser, 
            logoutUser, 
            refreshAccessToken,  
            changeCurrentPassword,
            getCurrentUser,
            updateAccountDetails,
            updateUserAvatar,
            updateUserCoverImage,
            getUserChannelProfile,
        };