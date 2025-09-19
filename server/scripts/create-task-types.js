require("dotenv").config();
const mongoose = require("mongoose");

// Define the TaskType schema directly (following the pattern from create-plans.js)
const { Schema } = mongoose;

const taskTypeSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      enum: ['product-optimization'],
      unique: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    unitCost: {
      type: Number,
      required: true,
      min: 0,
      default: 1,
    },
    unitType: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "unit",
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Add unique indexes
taskTypeSchema.index({ slug: 1 }, { unique: true });
taskTypeSchema.index({ name: 1, isActive: 1 }, { unique: true });

const createTaskTypes = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("🔗 Connected to MongoDB");

    // Create the TaskType model
    const TaskType = mongoose.model("TaskType", taskTypeSchema);

    console.log("🏷️ Creating basic task types...");

    const basicTaskTypes = [
      {
        name: "Product Optimization",
        slug: "product-optimization",
        description:
          "Optimize product listings, content, and marketplace performance to improve visibility and sales",
        unitCost: 1,
        unitType: "unit",
        isActive: true,
      },
    ];

    let created = 0;
    let updated = 0;

    for (const taskTypeData of basicTaskTypes) {
      const existingTaskType = await TaskType.findOne({
        slug: taskTypeData.slug,
      });

      if (existingTaskType) {
        // Update existing task type
        Object.assign(existingTaskType, taskTypeData);
        await existingTaskType.save();
        console.log(
          `✅ Updated: ${taskTypeData.name} [${taskTypeData.slug}] (${taskTypeData.unitCost} ${taskTypeData.unitType})`
        );
        updated++;
      } else {
        // Create new task type
        await TaskType.create(taskTypeData);
        console.log(
          `✅ Created: ${taskTypeData.name} [${taskTypeData.slug}] (${taskTypeData.unitCost} ${taskTypeData.unitType})`
        );
        created++;
      }
    }

    await mongoose.disconnect();
    console.log(
      `✅ Task types setup complete! Created: ${created}, Updated: ${updated}`
    );

    return { created, updated };
  } catch (error) {
    console.error("❌ Error creating task types:", error);
    process.exit(1);
  }
};

// Solo ejecutar si es llamado directamente
if (require.main === module) {
  createTaskTypes();
}

module.exports = createTaskTypes;
