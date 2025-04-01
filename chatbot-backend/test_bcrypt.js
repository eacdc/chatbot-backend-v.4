const bcrypt = require("bcryptjs");

const enteredPassword = "test";  // The password the user entered during login
const storedHash = "$2b$10$H8/OhkrgQ7a7aaxOOt4oausVilOHp/GUjveVKCxefTMPvXSWEXip6"; // The password hash from DB

async function checkPassword() {
    const isMatch = await bcrypt.compare(enteredPassword, storedHash);
    console.log("✅ Password matches:", isMatch);
}

checkPassword();
