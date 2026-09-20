const Application = require('../models/Application');

exports.showApplyForm = (req, res) => {
  res.render('public/apply', {
    pageTitle: 'Apply for Connection',
  });
};

exports.submitApplication = async (req, res) => {
  try {
    const { applicantName, email, phone, address, connectionType, utilityType } = req.body;

    const documents = req.files.map(file => ({
      filename: file.filename,
      path: `/uploads/documents/${file.filename}`,
      originalName: file.originalname,
      mimetype: file.mimetype,
    }));

    await Application.create({
      applicantName,
      email,
      phone,
      address,
      connectionType,
      utilityType,
      documents,
    });

    req.flash('success', 'Your application has been submitted successfully! We will contact you soon.');
    res.redirect('/');
  } catch (err) {
    console.error('submitApplication error:', err);
    req.flash('error', 'There was an error submitting your application. Please try again.');
    res.redirect('/apply');
  }
};
