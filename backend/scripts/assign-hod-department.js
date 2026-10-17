'use strict';

const config = require('../src/config/env');
const {
  connectDatabase,
  disconnectDatabase
} = require('../src/config/database');

const User = require('../src/models/User');
const Department = require('../src/models/Department');

const HOD_EMAIL = 'hod@college.edu';
const DEPARTMENT_CODE = 'CSE';

async function main() {
  if (config.NODE_ENV === 'production') {
    throw new Error(
      'This setup script is disabled in production.'
    );
  }

  await connectDatabase();

  try {
    const hod = await User.findOne({
      email: HOD_EMAIL
    });

    if (!hod) {
      throw new Error(`HOD account not found: ${HOD_EMAIL}`);
    }

    if (hod.role !== 'HOD' || !hod.isActive) {
      throw new Error(
        'The HOD account must have HOD role and be active.'
      );
    }

    const department = await Department.findOne({
      code: DEPARTMENT_CODE,
      isActive: true
    });

    if (!department) {
      throw new Error(
        'Active CSE department not found. Check Departments first.'
      );
    }

    if (
      department.hodId &&
      String(department.hodId) !== String(hod._id)
    ) {
      throw new Error(
        'CSE already has a different HOD assigned. No changes made.'
      );
    }

    // Add CSE to the HOD's department memberships.
    await User.updateOne(
      { _id: hod._id },
      { $addToSet: { departmentIds: department._id } }
    );

    // Set this user as the department's HOD.
    await Department.updateOne(
      { _id: department._id },
      { $set: { hodId: hod._id } }
    );

    console.log('HOD department assignment completed.');
    console.log(`HOD email: ${hod.email}`);
    console.log(`Department: ${department.name} (${department.code})`);
    console.log('Role and password were not changed.');
  } finally {
    await disconnectDatabase();
  }
}

main().catch(error => {
  console.error('Assignment failed:', error.message);
  process.exitCode = 1;
});