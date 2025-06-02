const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const cors = require('cors');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Multer setup for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Helper function to shuffle an array (Fisher-Yates shuffle)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Combined upload and generate endpoint
app.post('/api/generate', upload.single('excelFile'), async (req, res) => {
    try {
        const { paperType } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'No Excel file uploaded' });
        }

        // Parse the Excel file from buffer
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        console.log('Raw JSON data from Excel:', jsonData); // Debugging

        // Find the correct 'Question' column key (with potential whitespace)
        const questionKey = Object.keys(jsonData[0]).find(key => key.trim() === 'Question');
        if (!questionKey) {
            return res.status(400).json({ error: 'No "Question" column found in the Excel file' });
        }

        // Process the data into questionBank
        const questionBank = jsonData.map(row => {
            const questionText = row[questionKey] ? row[questionKey].trim() : '';
            let type;

            // Split the question into lines to check for options
            const lines = questionText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);

            // Check for fill-in-the-blank (blanks with 3 or more underscores)
            if (/_{3,}/.test(questionText)) {
                type = 'fill-in-the-blank';
            }
            // Check for objective questions (options like A., B., a), b), etc.)
            else if (lines.length > 1 && /^[A-Da-d][\.\)]\s+/.test(lines[1])) {
                type = 'objective';
            }
            // Default to objective if unclear
            else {
                type = 'objective';
            }

            return {
                subjectCode: row['Subject Code'],
                subject: row['Subject'],
                branch: row['Branch'],
                regulation: row['Regulation'],
                year: row['Year'],
                semester: row['Sem'],
                month: row['Month'],
                unit: row['Unit'],
                question: questionText, // Options are still embedded in the question string
                imageUrl: row['Image Url'] || null,
                type: type
            };
        });

        console.log('Processed questionBank:', questionBank); // Debugging

        if (questionBank.length === 0) {
            return res.status(400).json({ error: 'No questions found in the Excel file' });
        }

        // Filter questions by type and unit
        const objectiveByUnit = {
            1: questionBank.filter(q => q.unit === 1 && q.type === 'objective'),
            2: questionBank.filter(q => q.unit === 2 && q.type === 'objective'),
            3: questionBank.filter(q => q.unit === 3 && q.type === 'objective'),
            4: questionBank.filter(q => q.unit === 4 && q.type === 'objective'),
            5: questionBank.filter(q => q.unit === 5 && q.type === 'objective')
        };
        const fillInTheBlankByUnit = {
            1: questionBank.filter(q => q.unit === 1 && q.type === 'fill-in-the-blank'),
            2: questionBank.filter(q => q.unit === 2 && q.type === 'fill-in-the-blank'),
            3: questionBank.filter(q => q.unit === 3 && q.type === 'fill-in-the-blank'),
            4: questionBank.filter(q => q.unit === 4 && q.type === 'fill-in-the-blank'),
            5: questionBank.filter(q => q.unit === 5 && q.type === 'fill-in-the-blank')
        };

        console.log('Objective Questions by Unit:', objectiveByUnit); // Debugging
        console.log('Fill-in-the-Blank Questions by Unit:', fillInTheBlankByUnit); // Debugging

        // Select questions based on paper type
        let selectedQuestions = [];
        if (paperType === 'mid1') {
            // Mid 1: Objective (2 from Unit 1, 2 from Unit 2, 1 from Unit 3)
            if (objectiveByUnit[1].length < 2 || objectiveByUnit[2].length < 2 || objectiveByUnit[3].length < 1) {
                return res.status(400).json({ 
                    error: 'Insufficient objective questions for Mid 1: Need 2 from Unit 1, 2 from Unit 2, 1 from Unit 3' 
                });
            }
            if (fillInTheBlankByUnit[1].length < 2 || fillInTheBlankByUnit[2].length < 2 || fillInTheBlankByUnit[3].length < 1) {
                return res.status(400).json({ 
                    error: 'Insufficient fill-in-the-blank questions for Mid 1: Need 2 from Unit 1, 2 from Unit 2, 1 from Unit 3' 
                });
            }

            selectedQuestions = [
                ...shuffleArray([...objectiveByUnit[1]]).slice(0, 2), // Q1, Q2
                ...shuffleArray([...objectiveByUnit[2]]).slice(0, 2), // Q3, Q4
                ...shuffleArray([...objectiveByUnit[3]]).slice(0, 1), // Q5
                ...shuffleArray([...fillInTheBlankByUnit[1]]).slice(0, 2), // Q6, Q7
                ...shuffleArray([...fillInTheBlankByUnit[2]]).slice(0, 2), // Q8, Q9
                ...shuffleArray([...fillInTheBlankByUnit[3]]).slice(0, 1)  // Q10
            ];
        } else if (paperType === 'mid2') {
            // Mid 2: Objective (1 from Unit 3, 2 from Unit 4, 2 from Unit 5)
            if (objectiveByUnit[3].length < 1 || objectiveByUnit[4].length < 2 || objectiveByUnit[5].length < 2) {
                return res.status(400).json({ 
                    error: 'Insufficient objective questions for Mid 2: Need 1 from Unit 3, 2 from Unit 4, 2 from Unit 5' 
                });
            }
            if (fillInTheBlankByUnit[3].length < 1 || fillInTheBlankByUnit[4].length < 2 || fillInTheBlankByUnit[5].length < 2) {
                return res.status(400).json({ 
                    error: 'Insufficient fill-in-the-blank questions for Mid 2: Need 1 from Unit 3, 2 from Unit 4, 2 from Unit 5' 
                });
            }

            selectedQuestions = [
                ...shuffleArray([...objectiveByUnit[3]]).slice(0, 1), // Q1
                ...shuffleArray([...objectiveByUnit[4]]).slice(0, 2), // Q2, Q3
                ...shuffleArray([...objectiveByUnit[5]]).slice(0, 2), // Q4, Q5
                ...shuffleArray([...fillInTheBlankByUnit[3]]).slice(0, 1), // Q6
                ...shuffleArray([...fillInTheBlankByUnit[4]]).slice(0, 2), // Q7, Q8
                ...shuffleArray([...fillInTheBlankByUnit[5]]).slice(0, 2)  // Q9, Q10
            ];
        } else {
            return res.status(400).json({ error: 'Invalid paperType. Use "mid1" or "mid2".' });
        }

        // Extract paper details from the first question
        const paperDetails = {
            subjectCode: selectedQuestions[0].subjectCode,
            subject: selectedQuestions[0].subject,
            branch: selectedQuestions[0].branch,
            regulation: selectedQuestions[0].regulation,
            year: selectedQuestions[0].year,
            semester: selectedQuestions[0].semester,
            month: selectedQuestions[0].month
        };

        // Prepare response
        const response = {
            paperDetails,
            questions: selectedQuestions.map(q => ({
                question: q.question,
                unit: q.unit,
                imageUrl: q.imageUrl
            }))
        };

        console.log('Selected Questions:', response.questions); // Debugging
        res.status(200).json(response);
    } catch (error) {
        console.error('Error generating questions:', error);
        res.status(500).json({ error: 'Error generating question paper: ' + error.message });
    }
});

// Image proxy endpoint
app.get('/api/image-proxy-base64', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'No image URL provided' });

    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch image');
        
        const buffer = await response.buffer();
        const base64 = buffer.toString('base64');
        const mimeType = response.headers.get('content-type') || 'image/png';
        const dataUrl = `data:${mimeType};base64,${base64}`;

        res.json({ dataUrl });
    } catch (error) {
        console.error('Error fetching image:', error);
        res.status(500).json({ error: 'Failed to fetch image: ' + error.message });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
