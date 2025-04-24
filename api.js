// server.js
const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const User = require('./models/User');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'));

// Initialize owner if not present
(async () => {
  const existingOwner = await User.findOne({ username: 'Owner' });
  if (!existingOwner) {
    const owner = new User({
      username: 'Owner',
      password: 'Compass15!', // plaintext for demo — should hash in production
      role: 'owner'
    });
    await owner.save();
    console.log('Default owner account created.');
  }
})();

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// models/User.js
const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin', 'owner'], default: 'user' },
});
module.exports = mongoose.model('User', userSchema);

// middleware/authMiddleware.js
const User = require('../models/User');
const authMiddleware = async (req, res, next) => {
  const { username, password } = req.headers;
  if (!username || !password) return res.status(401).json({ message: 'Missing credentials' });

  const user = await User.findOne({ username, password });
  if (!user) return res.status(403).json({ message: 'Invalid credentials' });

  req.user = user;
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'owner') return next();
  res.status(403).json({ message: 'Admin access required' });
};

const requireOwner = (req, res, next) => {
  if (req.user.role === 'owner') return next();
  res.status(403).json({ message: 'Owner access required' });
};

module.exports = { authMiddleware, requireAdmin, requireOwner };

// routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = new User({ username, password });
    await user.save();
    res.status(201).json({ message: 'User created' });
  } catch (err) {
    res.status(400).json({ message: 'Signup failed', error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (!user) return res.status(403).json({ message: 'Invalid credentials' });
  res.status(200).json({ message: 'Login successful', role: user.role });
});

module.exports = router;

// routes/admin.js
const express = require('express');
const router = express.Router();
const { authMiddleware, requireAdmin, requireOwner } = require('../middleware/authMiddleware');
const User = require('../models/User');

router.use(authMiddleware);

router.get('/users', requireAdmin, async (req, res) => {
  const users = await User.find();
  res.json(users);
});

router.delete('/user/:username', requireOwner, async (req, res) => {
  const { username } = req.params;
  if (username === 'Owner') return res.status(400).json({ message: 'Cannot delete owner' });
  await User.deleteOne({ username });
  res.json({ message: `User ${username} deleted` });
});

module.exports = router;
