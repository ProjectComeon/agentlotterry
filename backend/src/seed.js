require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('./models/User');

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const existingAdmin = await User.findOne({ role: 'admin' });
    
    if (existingAdmin) {
      console.log('Admin account already exists:', existingAdmin.username);
      process.exit(0);
    }

    const admin = await User.create({
      username: 'admin',
      password: 'admin123',
      role: 'admin',
      name: 'Administrator',
      phone: '',
      isActive: true
    });

    console.log('✅ Admin account created successfully!');
    console.log('   Username:', admin.username);
    console.log('   Password: admin123');
    console.log('   ⚠️  Please change the password after first login!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error.message);
    process.exit(1);
  }
};

seedAdmin();
