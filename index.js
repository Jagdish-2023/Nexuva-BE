require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const authRoutes = require("./routes/auth");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

const corsOptions = {
  origin: "https://nexuva.vercel.app",
  Credentials: true,
  optionSuccessStatus: 200,
};
app.use(express.json());
app.use(cors(corsOptions));

const initializeDB = require("./db/db.connect");
const SalesAgent = require("./models/salesAgent.model");
const Lead = require("./models/lead.model");
const Comment = require("./models/comment.model");
const User = require("./models/User.model");

initializeDB();

app.use("/auth", authRoutes);

const verifyJWT = (req, res, next) => {
  const userToken = req.headers.authorization.split(" ")[1];

  if (!userToken) {
    return res
      .status(401)
      .json({ error: "userToken is required for authorization" });
  }

  try {
    const decodedToken = jwt.verify(userToken, JWT_SECRET);

    req.user = decodedToken;

    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired userToken" });
  }
};

//get call
app.get("/agents", verifyJWT, async (req, res) => {
  try {
    const allAgents = await SalesAgent.find();
    if (allAgents.length > 0) {
      res.status(200).json(allAgents);
    } else {
      res.status(404).json({ error: "Agents not found." });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/leads", verifyJWT, async (req, res) => {
  const queryParams = req.query;
  let filter = { ...queryParams };

  try {
    if (queryParams.salesAgent) {
      const agent = await SalesAgent.findOne({ name: queryParams.salesAgent });

      if (agent) {
        filter.salesAgent = agent._id;
      } else {
        return res.status(404).json({ error: "Sales agent not found" });
      }
    }

    const leads = await Lead.find(filter).populate("salesAgent", "_id name");

    if (leads.length === 0) {
      return res.status(404).json({ error: "Leads not found" });
    }
    res.status(200).json(leads);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/leads/:leadId", verifyJWT, async (req, res) => {
  const leadId = req.params.leadId;
  try {
    const lead = await Lead.findById(leadId).populate("salesAgent", "_id name");
    if (!lead) {
      return res.status(404).json({ Error: "Lead not found" });
    }

    if (lead.comments) {
      await lead.populate("comments.author", "_id name");
    }

    res.status(200).json(lead);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/profile", verifyJWT, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "Profile not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

//post call
app.post("/leads", verifyJWT, async (req, res) => {
  const leadInfo = req.body;
  const isClosed = leadInfo.status === "Closed";
  try {
    if (isClosed) {
      leadInfo.closedAt = Date.now();
    }
    const newLead = new Lead(leadInfo);
    const savedLead = await newLead.save();
    await savedLead.populate("salesAgent", "_id name");

    res.status(201).json({ message: "Lead added successfully", savedLead });
  } catch (error) {
    res.status(500).json({ Error: "Internal server error." });
  }
});

app.post("/agents", verifyJWT, async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    res
      .status(400)
      .json({ error: "Invalid input: name and email fields are required" });
    return;
  }

  try {
    const newAgent = new SalesAgent({ name, email });
    const savedAgent = await newAgent.save();
    if (savedAgent) {
      res.status(201).json(savedAgent);
    }
  } catch (error) {
    if (error.code === 11000) {
      res
        .status(409)
        .json({ error: `Sales agent with email "${email}" already exists.` });
    } else {
      res.status(500).json({ error: "Internal server problem" });
    }
  }
});

app.post("/leads/:leadId", verifyJWT, async (req, res) => {
  const leadId = req.params.leadId;
  const dataToUpdate = req.body;

  try {
    const updatedLead = await Lead.findByIdAndUpdate(leadId, dataToUpdate, {
      new: true,
    });

    if (!updatedLead) {
      return res
        .status(404)
        .json({ error: `Lead with ID ${leadId} not found.` });
    }

    await updatedLead.populate("salesAgent", "_id name");

    if (updatedLead.comments) {
      await updatedLead.populate("comments.author", "_id name");
    }

    res.status(200).json(updatedLead);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/leads/:leadId/comments", verifyJWT, async (req, res) => {
  const leadId = req.params.leadId;
  const comment = req.body;
  const { author, commentText } = comment;
  try {
    if (!author || !commentText) {
      return res
        .status(400)
        .json({ error: "author & commentText fields are required." });
    }
    const newComment = new Comment({ lead: leadId, author, commentText });
    const savedComment = await newComment.save();

    if (savedComment) {
      const allComments = await Comment.find({ lead: leadId });

      const leadWithComments = await Lead.findByIdAndUpdate(
        leadId,
        { comments: allComments },
        { new: true }
      ).populate("salesAgent", "_id name");

      await leadWithComments.populate("comments.author", "_id name");

      return res.status(200).json(leadWithComments);
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server is running on Port ", PORT);
});
