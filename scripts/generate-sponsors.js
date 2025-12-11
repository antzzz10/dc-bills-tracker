import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the CSV file
const csvPath = '/Users/andriathomas/Downloads/congress_roster_119.csv';
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// Parse CSV
const lines = csvContent.split('\n');
const headers = lines[0].split(',');

const sponsors = {};

// Skip header row
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const values = line.split(',');
  if (values.length < 5) continue;

  const memberName = values[0];
  const state = values[1];
  const district = values[2];
  const party = values[3];
  const chamber = values[4];

  // Create lookup key in the format used by bills.json
  // Extract last name for matching
  const nameParts = memberName.split(' ');
  const lastName = nameParts[nameParts.length - 1];

  // Try to match common formats
  const prefix = chamber === 'Senate' ? 'Sen' : 'Rep';

  // Create multiple possible keys for flexible matching
  const keys = [
    `${prefix} ${memberName}`, // Full name: "Rep Nancy Mace"
    `${prefix} ${nameParts[0]} ${lastName}`, // First + Last: "Rep Nancy Mace"
  ];

  // Add middle initial versions if they exist
  if (nameParts.length > 2) {
    const firstName = nameParts[0];
    const middleInitial = nameParts[1].charAt(0);
    keys.push(`${prefix} ${firstName} ${middleInitial}. ${lastName}`);
  }

  const sponsorData = {
    name: memberName,
    state: state,
    district: district === 'Statewide' ? null : district,
    party: party === 'Democratic' ? 'D' : party === 'Republican' ? 'R' : party.charAt(0),
    chamber: chamber
  };

  // Add all key variations
  keys.forEach(key => {
    sponsors[key] = sponsorData;
  });
}

// Output the sponsors lookup file
const outputPath = path.join(__dirname, '..', 'src', 'data', 'sponsors.json');
fs.writeFileSync(outputPath, JSON.stringify(sponsors, null, 2));

console.log(`✓ Generated sponsors.json with ${Object.keys(sponsors).length} entries`);
console.log(`✓ Covering ${new Set(Object.values(sponsors).map(s => s.name)).size} unique members`);
