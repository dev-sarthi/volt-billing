/**
 * Computes a bill progressively through tariff slabs.
 * 
 * @param {Number} unitsConsumed - The total units consumed.
 * @param {Object} tariffPlan - The tariff plan object (must have slabs array and fixedCharge).
 * @returns {Object} { usageCharge, fixedCharge, totalAmount }
 */
function computeBill(unitsConsumed, tariffPlan) {
  let remainingUnits = unitsConsumed;
  let usageCharge = 0;

  // Slabs are assumed to be sorted in ascending order of minUnits
  for (const slab of tariffPlan.slabs) {
    if (remainingUnits <= 0) break;

    // Calculate how many units fit into this current slab
    // Note: If slab starts at 0, its capacity is just maxUnits (since the "0th" unit isn't billed)
    const slabCapacity = slab.minUnits === 0 
      ? slab.maxUnits 
      : (slab.maxUnits - slab.minUnits + 1);
    
    // Take the smaller of what's remaining or the slab's capacity
    const unitsInSlab = Math.min(remainingUnits, slabCapacity);
    
    usageCharge += unitsInSlab * slab.ratePerUnit;
    remainingUnits -= unitsInSlab;
  }

  const fixedCharge = tariffPlan.fixedCharge;
  const totalAmount = usageCharge + fixedCharge;

  return {
    usageCharge,
    fixedCharge,
    totalAmount
  };
}

module.exports = {
  computeBill,
  selfCorrectOverdueBills
};

/**
 * Self-corrects any 'unpaid' bills that have passed their due date by
 * marking them as 'overdue' and applying a 2% late-payment surcharge.
 * 
 * @param {Object} queryFilter - Additional mongoose query filters (e.g. { consumerId: req.consumerId })
 */
async function selfCorrectOverdueBills(queryFilter = {}) {
  const Bill = require('../models/Bill');
  
  const filter = {
    ...queryFilter,
    status: 'unpaid',
    dueDate: { $lt: new Date() }
  };

  // Using MongoDB 4.2+ pipeline update to dynamically calculate the 2% surcharge based on each document's totalAmount
  await Bill.updateMany(filter, [
    {
      $set: {
        status: 'overdue',
        surcharge: { $round: [{ $multiply: ['$totalAmount', 0.02] }, 0] },
        totalAmount: { $add: ['$totalAmount', { $round: [{ $multiply: ['$totalAmount', 0.02] }, 0] }] }
      }
    }
  ]);
}
