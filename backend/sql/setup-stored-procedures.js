const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setupStoredProcedures() {
  const connection = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "root",
    multipleStatements: true,
    database: "smart_society"
  });

  try {
    console.log("📝 Creating stored procedures...");
    
    const sqlFile = path.join(__dirname, 'stored-procedures.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    await connection.query(sql);
    console.log("✅ Stored procedures created successfully!");
    
    // List procedures
    const [procedures] = await connection.query(
      "SHOW PROCEDURE STATUS WHERE Db = 'smart_society'"
    );
    console.log("\n📋 Created procedures:");
    procedures.forEach(p => console.log(`  - ${p.name}`));
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await connection.end();
  }
}

setupStoredProcedures();