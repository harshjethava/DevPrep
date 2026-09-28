const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/devprep').then(async () => {
  
  const Submissions = mongoose.connection.collection('submissions');
  const saved = mongoose.connection.collection('savedquestions');
  
  const sAgg = await Submissions.aggregate([
    { $group: { _id: '$problemId' } }
  ]).toArray();

  const totalSubmissions = await Submissions.countDocuments();

  const savedDiff = await saved.aggregate([
    { $group: { _id: '$difficulty', count: { $sum: 1 } } }
  ]).toArray();

  console.log('Total submissions:', totalSubmissions);
  console.log('Unique problems attempted:', sAgg.length);
  console.log('Saved Questions Diff:', savedDiff);
  
  process.exit();
});
