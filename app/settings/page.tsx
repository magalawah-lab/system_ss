"use client";

import React, { useState } from "react";
import ContextMenu from "../components/ContextMenu";
import { useSchoolData } from "../context/SchoolDataContext";

export default function Settings() {
  const [theme, setTheme] = useState("system");
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [backupStatus, setBackupStatus] = useState<string>("");
  const [restoreStatus, setRestoreStatus] = useState<string>("");
  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [isRestoreLoading, setIsRestoreLoading] = useState(false);
  const { saveChanges } = useSchoolData();

  // Validate backup file structure
  const validateBackupData = (data: any): { valid: boolean; message?: string } => {
    if (!data) {
      return { valid: false, message: "No data provided" };
    }

    // Check for required top-level properties
    const requiredKeys = ['classes', 'teachers', 'catalog', 'academicYears'];
    const missingKeys = requiredKeys.filter(key => !(key in data));
    
    if (missingKeys.length > 0) {
      return { 
        valid: false, 
        message: `Missing required keys: ${missingKeys.join(', ')}` 
      };
    }

    // Validate data types
    if (!Array.isArray(data.classes)) {
      return { valid: false, message: "Classes must be an array" };
    }
    if (!Array.isArray(data.teachers)) {
      return { valid: false, message: "Teachers must be an array" };
    }
    if (typeof data.catalog !== 'object') {
      return { valid: false, message: "Catalog must be an object" };
    }
    if (!Array.isArray(data.academicYears)) {
      return { valid: false, message: "Academic years must be an array" };
    }

    // Validate classes structure
    if (data.classes.length > 0) {
      const firstClass = data.classes[0];
      if (!firstClass.name || !firstClass.level) {
        return { 
          valid: false, 
          message: "Invalid class structure. Each class must have name and level" 
        };
      }
    }

    return { valid: true };
  };

  async function handleDownloadBackup() {
    setIsBackupLoading(true);
    setBackupStatus("Preparing backup...");
    
    try {
      // Get current data from the API
      const response = await fetch("/api/backup", { 
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error (${response.status}): ${errorText || 'Unknown error'}`);
      }

      // Check if the response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        throw new Error("Received non-JSON response from server");
      }

      const data = await response.json();
      
      // Validate the data structure
      const validation = validateBackupData(data);
      if (!validation.valid) {
        throw new Error(`Invalid backup data: ${validation.message}`);
      }

      // Create a formatted JSON with timestamp
      const backupPayload = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        data: data,
        metadata: {
          totalClasses: data.classes?.length || 0,
          totalTeachers: data.teachers?.length || 0,
          totalAcademicYears: data.academicYears?.length || 0,
          catalogEntries: Object.keys(data.catalog || {}).length,
        }
      };

      const jsonString = JSON.stringify(backupPayload, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      
      const fileName = `school-backup-${new Date().toISOString().slice(0, 10)}.json`;
      
      // Download the file
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      
      // Clean up
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setBackupStatus(`✅ Backup downloaded successfully! (${backupPayload.metadata.totalClasses} classes, ${backupPayload.metadata.totalTeachers} teachers)`);
    } catch (error) {
      console.error("Backup error:", error);
      setBackupStatus(`❌ Backup failed: ${(error as Error).message}`);
    } finally {
      setIsBackupLoading(false);
    }
  }

  async function handleRestoreBackup() {
    if (!restoreFile) {
      setRestoreStatus("⚠️ Please select a backup file first.");
      return;
    }

    // Validate file type
    if (!restoreFile.name.endsWith('.json')) {
      setRestoreStatus("❌ Please select a valid JSON file.");
      return;
    }

    // Check file size (max 50MB)
    if (restoreFile.size > 50 * 1024 * 1024) {
      setRestoreStatus("❌ File too large. Maximum size is 50MB.");
      return;
    }

    const proceed = window.confirm(
      "⚠️ RESTORE WARNING:\n\n" +
      "This will OVERWRITE all current data including:\n" +
      "• Classes and streams\n" +
      "• Students\n" +
      "• Teachers\n" +
      "• Assessments and scores\n" +
      "• Academic years and terms\n\n" +
      "This action CANNOT BE UNDONE!\n\n" +
      "Are you sure you want to continue?"
    );
    
    if (!proceed) return;

    setIsRestoreLoading(true);
    setRestoreStatus("⏳ Restoring backup...");

    try {
      // Read the file
      const raw = await restoreFile.text();
      
      // Parse JSON
      let payload: any;
      try {
        payload = JSON.parse(raw);
      } catch (parseError) {
        throw new Error("Invalid JSON format. Please check the file.");
      }

      // Check if it's the new backup format (with version and metadata)
      let dataToRestore: any;
      if (payload.version && payload.data) {
        // New format
        dataToRestore = payload.data;
        
        // Validate the data
        const validation = validateBackupData(dataToRestore);
        if (!validation.valid) {
          throw new Error(`Invalid backup format: ${validation.message}`);
        }

        // Show metadata summary
        const metadata = payload.metadata || {
          totalClasses: dataToRestore.classes?.length || 0,
          totalTeachers: dataToRestore.teachers?.length || 0,
          totalAcademicYears: dataToRestore.academicYears?.length || 0,
          catalogEntries: Object.keys(dataToRestore.catalog || {}).length,
        };
        
        const confirmRestore = window.confirm(
          `Backup Summary:\n` +
          `- Classes: ${metadata.totalClasses}\n` +
          `- Teachers: ${metadata.totalTeachers}\n` +
          `- Academic Years: ${metadata.totalAcademicYears}\n` +
          `- Catalog Entries: ${metadata.catalogEntries}\n\n` +
          `Click OK to continue with restore.`
        );
        
        if (!confirmRestore) {
          setRestoreStatus("Restore cancelled.");
          setIsRestoreLoading(false);
          return;
        }
      } else {
        // Legacy format (direct data object)
        dataToRestore = payload;
        
        // Validate legacy data
        const validation = validateBackupData(dataToRestore);
        if (!validation.valid) {
          throw new Error(`Invalid backup format: ${validation.message}`);
        }
      }

      // Send to server for restore
      const response = await fetch("/api/backup", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: dataToRestore,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Restore failed (${response.status})`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      setRestoreStatus(`✅ Restore complete! ${result.message || 'Data restored successfully'}`);
      
      // Save changes to ensure data is persisted
      await saveChanges();
      
      // Show success message before reloading
      setTimeout(() => {
        if (confirm("✅ Restore completed successfully!\n\nClick OK to reload the page and see the restored data.")) {
          window.location.reload();
        } else {
          setRestoreStatus("✅ Restore complete. Please reload the page manually to see changes.");
        }
      }, 500);

    } catch (error) {
      console.error("Restore error:", error);
      setRestoreStatus(`❌ Restore failed: ${(error as Error).message}`);
    } finally {
      setIsRestoreLoading(false);
    }
  }

  async function handleResetData() {
    const confirmReset = window.confirm(
      "⚠️ RESET DATA WARNING:\n\n" +
      "This will DELETE ALL DATA from your database.\n" +
      "This includes all classes, students, teachers, assessments, and scores.\n\n" +
      "This action CANNOT BE UNDONE!\n\n" +
      "Are you absolutely sure you want to proceed?"
    );
    
    if (!confirmReset) return;

    const confirmAgain = window.confirm(
      "FINAL WARNING:\n\n" +
      "All data will be permanently deleted.\n" +
      "Make sure you have a backup before proceeding.\n\n" +
      "Type 'YES' to confirm:"
    );

    // Simple confirmation - could be more robust
    if (!confirmAgain) return;

    try {
      setRestoreStatus("⏳ Resetting data...");
      
      const response = await fetch("/api/backup", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to reset data");
      }

      setRestoreStatus("✅ Data reset successfully. Reloading...");
      setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setRestoreStatus(`❌ Reset failed: ${(error as Error).message}`);
    }
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>Settings</h1>
        <p className="subtitle">Application settings and database management</p>
      </div>

      <div className="settings-grid">
        {/* Appearance Section */}
        <section className="settings-card">
          <div className="card-header">
            <div className="header-icon">🎨</div>
            <h3>Appearance</h3>
          </div>
          <div className="card-content">
            <div className="setting-row">
              <label htmlFor="theme-select">Theme Preference</label>
              <select 
                id="theme-select"
                value={theme} 
                onChange={(e) => setTheme(e.target.value)} 
                className="select-input"
              >
                <option value="light">Light Mode</option>
                <option value="dark">Dark Mode</option>
                <option value="system">System Default</option>
              </select>
            </div>
            
            <div className="actions-row" style={{ marginTop: '1.5rem', display: 'flex', gap: '12px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { if (confirm('Reset theme to system default?')) setTheme('system'); }}>
                Reset Theme
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => alert('Settings export coming soon')}>
                Export Preferences
              </button>
            </div>
          </div>
        </section>

        {/* Database Management Section */}
        <section className="settings-card highlight">
          <div className="card-header">
            <div className="header-icon">💾</div>
            <h3>Database Backup & Restore</h3>
          </div>
          <div className="card-content">
            <p className="description">
              Secure your data by downloading a full backup. You can restore your entire system (classes, students, teachers, and scores) from a previously saved backup file.
            </p>

            <div className="backup-actions">
              <div className="action-box">
                <h4>Create Backup</h4>
                <p>Generate a downloadable JSON file containing all current school data.</p>
                <button 
                  className="btn btn-primary" 
                  onClick={handleDownloadBackup}
                  disabled={isBackupLoading}
                >
                  {isBackupLoading ? '⏳ Generating...' : '📥 Download Backup File'}
                </button>
                {backupStatus && (
                  <p className={`status-msg ${backupStatus.includes('failed') || backupStatus.includes('❌') ? 'error' : ''}`}>
                    {backupStatus}
                  </p>
                )}
              </div>

              <div className="action-box">
                <h4>Restore Data</h4>
                <p>Upload a backup file to overwrite current data. <strong>Warning: This action cannot be undone.</strong></p>
                <div className="restore-upload">
                  <div className="file-input-wrapper">
                    <input
                      type="file"
                      id="restore-file"
                      accept=".json,application/json"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setRestoreFile(file);
                        setRestoreStatus(file ? `📄 Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)` : "");
                      }}
                      className="file-input"
                      disabled={isRestoreLoading}
                    />
                    <label htmlFor="restore-file" className="file-label">
                      {restoreFile ? restoreFile.name : 'Choose a backup file...'}
                    </label>
                  </div>
                  <button 
                    className="btn btn-danger" 
                    onClick={handleRestoreBackup} 
                    disabled={!restoreFile || isRestoreLoading}
                  >
                    {isRestoreLoading ? '⏳ Restoring...' : '⚠️ Restore from File'}
                  </button>
                </div>
                {restoreStatus && (
                  <p className={`status-msg ${restoreStatus.includes('failed') || restoreStatus.includes('❌') ? 'error' : ''}`}>
                    {restoreStatus}
                  </p>
                )}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="danger-zone" style={{ marginTop: '2rem', borderTop: '2px solid var(--danger)', paddingTop: '1.5rem' }}>
              <h4 style={{ color: 'var(--danger)', margin: '0 0 0.5rem 0' }}>⚠️ Danger Zone</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Resetting will permanently delete all data. Make sure you have a backup first.
              </p>
              <button 
                className="btn btn-danger" 
                onClick={handleResetData}
                style={{ background: 'var(--danger)', color: 'white' }}
              >
                🗑️ Reset All Data
              </button>
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        .settings-page {
          padding: 2rem;
          max-width: 1000px;
          margin: 0 auto;
        }
        .page-header {
          margin-bottom: 2.5rem;
        }
        .subtitle {
          color: var(--text-muted);
          margin-top: 0.5rem;
        }
        
        .settings-grid {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }
        
        .settings-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: var(--shadow-sm);
          overflow: hidden;
        }
        .settings-card.highlight {
          border-left: 4px solid var(--primary);
        }
        
        .card-header {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: rgba(0,0,0,0.02);
        }
        .header-icon {
          font-size: 1.25rem;
        }
        .card-header h3 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
        }
        
        .card-content {
          padding: 1.5rem;
        }
        
        .setting-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }
        .setting-row label {
          font-weight: 500;
          color: var(--text-main);
        }
        
        .select-input {
          padding: 0.6rem 1rem;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--background);
          min-width: 200px;
          font-size: 0.95rem;
        }
        
        .description {
          color: var(--text-muted);
          line-height: 1.5;
          margin-bottom: 2rem;
          font-size: 0.95rem;
        }
        
        .backup-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
        }
        
        .action-box {
          background: var(--background);
          padding: 1.5rem;
          border-radius: 8px;
          border: 1px solid var(--border);
          display: flex;
          flex-direction: column;
        }
        .action-box h4 {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
          font-weight: 600;
        }
        .action-box p {
          margin: 0 0 1.5rem 0;
          font-size: 0.85rem;
          color: var(--text-muted);
          flex-grow: 1;
        }
        
        .restore-upload {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .file-input-wrapper {
          position: relative;
          width: 100%;
        }
        
        .file-input {
          position: absolute;
          width: 0.1px;
          height: 0.1px;
          opacity: 0;
          overflow: hidden;
          z-index: -1;
        }
        
        .file-label {
          display: block;
          padding: 0.6rem 1rem;
          border: 2px dashed var(--border);
          border-radius: 6px;
          background: white;
          cursor: pointer;
          text-align: center;
          font-size: 0.9rem;
          color: var(--text-muted);
          transition: all 0.2s;
        }
        
        .file-label:hover {
          border-color: var(--primary);
          background: #f8faff;
        }
        
        .btn {
          padding: 0.6rem 1.2rem;
          border-radius: 6px;
          border: none;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.95rem;
        }
        
        .btn-primary {
          background: var(--primary);
          color: white;
        }
        .btn-primary:hover:not(:disabled) {
          background: var(--primary-light);
          transform: translateY(-1px);
        }
        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .btn-danger {
          background: #dc2626;
          color: white;
        }
        .btn-danger:hover:not(:disabled) {
          background: #b91c1c;
          transform: translateY(-1px);
        }
        .btn-danger:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .btn-sm {
          padding: 0.3rem 0.8rem;
          font-size: 0.85rem;
        }
        
        .btn-secondary {
          background: var(--background);
          border: 1px solid var(--border);
          color: var(--text-main);
        }
        .btn-secondary:hover {
          background: var(--border);
        }
        
        .status-msg {
          margin-top: 1rem;
          font-size: 0.85rem;
          font-weight: 500;
          padding: 0.5rem 0.75rem;
          border-radius: 4px;
          background: rgba(16, 185, 129, 0.1);
          color: #059669;
        }
        .status-msg.error {
          background: rgba(239, 68, 68, 0.1);
          color: #dc2626;
        }
        
        @media (max-width: 768px) {
          .settings-page {
            padding: 1rem;
          }
          .backup-actions {
            grid-template-columns: 1fr;
          }
          .setting-row {
            flex-direction: column;
            align-items: stretch;
          }
          .select-input {
            min-width: 100%;
          }
        }
      `}</style>
    </div>
  );
}