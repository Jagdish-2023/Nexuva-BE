require("dotenv").config();
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User.model");
const JWT_SECRET = process.env.JWT_SECRET;

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const findUserEmail = await User.findOne({ email });
    if (findUserEmail) {
      return res
        .status(409)
        .json({ message: "This email is already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    res.status(201).json({ message: "Account created successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to register the Account" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const findUserByEmail = await User.findOne({ email });
    if (!findUserByEmail) {
      return res.status(400).json({ message: "Invalid Email" });
    }

    const verifyPassword = await bcrypt.compare(
      password,
      findUserByEmail.password
    );

    if (!verifyPassword) {
      return res.status(400).json({ message: "Invalid Password" });
    }

    const jwtToken = jwt.sign(
      { role: "user", id: findUserByEmail._id },
      JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );
    res
      .status(200)
      .json({ message: "Logged in successfully", token: jwtToken });
  } catch (error) {
    res.status(500).json({ message: "Failed to login into your Account" });
  }
});

module.exports = router;
