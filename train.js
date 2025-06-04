// train.js
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey:
    process.env.OPENAI_API_KEY, // 🔑 Replace with your real OpenAI API key
});

async function uploadAndFineTune() {
  const filePath = path.join(__dirname, "training_data.jsonl");

  // Upload training file
  const file = await openai.files.create({
    file: fs.createReadStream(filePath),
    purpose: "fine-tune",
  });

  console.log("Uploaded training file:", file.id);

  // Start fine-tuning
  const fineTune = await openai.fineTuning.jobs.create({
    training_file: file.id,
    model: "gpt-3.5-turbo",
  });

  console.log("Fine-tuning started:");
  console.log("FineTune ID:", fineTune.id);
  console.log("Status:", fineTune.status);
}

uploadAndFineTune().catch(console.error);
