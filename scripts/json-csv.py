import json
import csv

with open('backup.json', 'r') as f:
    data = json.load(f)

# Convert teachers to CSV
with open('teachers.csv', 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['id', 'name', 'email', 'initials'])
    for teacher in data['data']['teachers']:
        writer.writerow([teacher['id'], teacher['name'], 
                        teacher['email'], teacher['initials']])