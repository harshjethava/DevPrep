const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://devprep_user:AurUhXAOOGWzRmgS@devprep.3zwn9zq.mongodb.net/devprep?retryWrites=true&w=majority&appName=DevPrep').then(async () => {
  const User = mongoose.connection.collection('users');
  const user = await User.findOne({});
  
  const Submissions = mongoose.connection.collection('submissions');
  const saved = mongoose.connection.collection('savedquestions');
  
  const sAggUnique = await Submissions.aggregate([
    { $match: { userId: user._id } },
    { $group: { _id: '$problemId' } }
  ]).toArray();

  const totalSubmissions = await Submissions.countDocuments({ userId: user._id });

  const subDiffAgg = await Submissions.aggregate([
    { $match: { userId: user._id } },
    { $lookup: { from: 'codingproblems', localField: 'problemId', foreignField: '_id', as: 'p' } },
    { $unwind: '$p' },
    { $group: { _id: '$p.difficulty', count: { $sum: 1 } } }
  ]).toArray();

  const subDiffUniqueAgg = await Submissions.aggregate([
    { $match: { userId: user._id } },
    { $group: { _id: '$problemId' } },
    { $lookup: { from: 'codingproblems', localField: '_id', foreignField: '_id', as: 'p' } },
    { $unwind: '$p' },
    { $group: { _id: '$p.difficulty', count: { $sum: 1 } } }
  ]).toArray();

  const savedDiff = await saved.aggregate([
    { $match: { userId: user._id } },
    { $group: { _id: '$difficulty', count: { $sum: 1 } } }
  ]).toArray();

  console.log('Total submissions:', totalSubmissions);
  console.log('Unique problems attempted:', sAggUnique.length);
  console.log('Submission Total Diff:', subDiffAgg);
  console.log('Submission Unique Diff:', subDiffUniqueAgg);
  console.log('Saved Questions (Quiz) Diff:', savedDiff);
  
  process.exit();
});
