#!/usr/bin/env python3
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import ListFlowable, ListItem, PageBreak, Paragraph, Preformatted, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'docs' / 'new-server-installation-guide.pdf'

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='BodySmall', parent=styles['BodyText'], fontName='Times-Roman', fontSize=10.5, leading=14, spaceAfter=6, alignment=TA_LEFT))
styles.add(ParagraphStyle(name='CodeBlock', parent=styles['BodyText'], fontName='Courier', fontSize=8.7, leading=10.5, leftIndent=6, rightIndent=6, borderColor=colors.HexColor('#d6dde2'), borderWidth=0.5, borderPadding=6, backColor=colors.HexColor('#f6f8f9'), spaceBefore=6, spaceAfter=8))
styles.add(ParagraphStyle(name='SectionHeading', parent=styles['Heading2'], fontName='Times-Bold', fontSize=15, leading=18, textColor=colors.HexColor('#13212b'), spaceBefore=10, spaceAfter=6))
styles.add(ParagraphStyle(name='SmallHeading', parent=styles['Heading3'], fontName='Times-Bold', fontSize=11.5, leading=14, textColor=colors.HexColor('#13212b'), spaceBefore=8, spaceAfter=4))
styles['Title'].fontName = 'Times-Bold'
styles['Title'].fontSize = 22
styles['Title'].leading = 26
styles['Title'].textColor = colors.HexColor('#13212b')
styles['Normal'].fontName = 'Times-Roman'
styles['Normal'].fontSize = 10.5
styles['Normal'].leading = 14
styles['Italic'].fontName = 'Times-Italic'


def code_block(text: str) -> Preformatted:
    return Preformatted(text, styles['CodeBlock'])


def bullet_list(items: list[str]) -> ListFlowable:
    return ListFlowable(
        [ListItem(Paragraph(item, styles['BodySmall'])) for item in items],
        bulletType='bullet',
        start='circle',
        leftIndent=14,
    )


def build_story() -> list:
    story = []
    story.append(Paragraph('ITMS New Server Installation Guide', styles['Title']))
    story.append(Spacer(1, 4))
    story.append(Paragraph('Repo-native deployment checklist for a fresh Ubuntu host running the full ITMS stack: backend, Postgres, nginx frontend, Salt, Wazuh, ClamAV, and OpenSCAP.', styles['BodySmall']))
    story.append(Spacer(1, 8))

    story.append(Paragraph('Quick Start', styles['SectionHeading']))
    story.append(Paragraph('Use this minimal flow when you just want the shortest copy-paste path on a fresh server.', styles['BodySmall']))
    story.append(Paragraph('1. Install prerequisites', styles['SmallHeading']))
    story.append(code_block('sudo apt-get update\nsudo apt-get install -y git curl ca-certificates\ncurl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -\nsudo apt-get install -y nodejs'))
    story.append(Paragraph('2. Clone the repository', styles['SmallHeading']))
    story.append(code_block('git clone https://github.com/Mohdgani-vibe/zerodha-itms.git /home/itms/itms\ncd /home/itms/itms'))
    story.append(Paragraph('3. Run the single installer', styles['SmallHeading']))
    story.append(code_block("SERVER_IP=YOUR_SERVER_IP \\\n+SERVER_NAME=YOUR_DOMAIN_OR_IP \\\n+DEFAULT_ADMIN_PASSWORD='YOUR_STRONG_ADMIN_PASSWORD' \\\n+JWT_SECRET='YOUR_LONG_RANDOM_JWT_SECRET' \\\n+SALT_API_PASSWORD='YOUR_STRONG_SALT_PASSWORD' \\\n+WAZUH_API_PASSWORD='YOUR_STRONG_WAZUH_PASSWORD' \\\n+bash docs/install-itms-all-in-one.sh"))

    story.append(Paragraph('Before You Start', styles['SectionHeading']))
    story.append(Paragraph('Use a fresh Ubuntu server with outbound internet access and a sudo-capable user account.', styles['BodySmall']))
    story.append(bullet_list([
        'Required before cloning: git, curl, ca-certificates',
        'Required before frontend deployment: Node.js 22+ and npm',
        'Installed by the repo scripts: Docker Engine, Docker Compose plugin, nginx, Salt, Wazuh, OpenSCAP packages, and optionally ClamAV',
        'Open inbound port 80 for the web UI. Use SERVER_NAME when serving by domain instead of raw IP',
    ]))

    story.append(Paragraph('Seeded Login', styles['SectionHeading']))
    story.append(Paragraph('For a fresh database, the seeded super admin user is <b>admin@zerodha.com</b>.', styles['BodySmall']))
    story.append(Paragraph('The password is the value of <b>DEFAULT_ADMIN_PASSWORD</b> from <b>backend/.env.secrets</b> at first startup.', styles['BodySmall']))

    story.append(Paragraph('Any IP Support', styles['SectionHeading']))
    story.append(Paragraph('The all-in-one installer works on any server IP. It auto-detects the host IP by default and you can override it with SERVER_IP and SERVER_NAME when needed.', styles['BodySmall']))
    story.append(code_block('SERVER_IP=YOUR_SERVER_IP SERVER_NAME=YOUR_DOMAIN_OR_IP bash docs/install-itms-all-in-one.sh'))

    story.append(Paragraph('Repository', styles['SectionHeading']))
    story.append(code_block('sudo apt-get update\nsudo apt-get install -y git curl ca-certificates'))
    story.append(code_block('curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -\nsudo apt-get install -y nodejs'))
    story.append(code_block('git clone https://github.com/Mohdgani-vibe/zerodha-itms.git /home/itms/itms'))
    story.append(code_block('cd /home/itms/itms'))

    story.append(Paragraph('Single File Install', styles['SectionHeading']))
    story.append(code_block("cd /home/itms/itms\nSERVER_IP=YOUR_SERVER_IP \\\nSERVER_NAME=YOUR_DOMAIN_OR_IP \\\nDEFAULT_ADMIN_PASSWORD='YOUR_STRONG_ADMIN_PASSWORD' \\\nJWT_SECRET='YOUR_LONG_RANDOM_JWT_SECRET' \\\nSALT_API_PASSWORD='YOUR_STRONG_SALT_PASSWORD' \\\nWAZUH_API_PASSWORD='YOUR_STRONG_WAZUH_PASSWORD' \\\nbash docs/install-itms-all-in-one.sh"))
    story.append(Paragraph('If SERVER_IP is omitted, the script tries to detect the current host IP automatically.', styles['BodySmall']))

    story.append(Paragraph('Config Files To Update', styles['SectionHeading']))
    story.append(Paragraph('On a new server, only two backend config files must be set before first startup.', styles['BodySmall']))
    story.append(bullet_list([
        'backend/.env: public URL, frontend origin, admin email and name, Salt host, Wazuh host',
        'backend/.env.secrets: admin password, JWT secret, Salt API password, Wazuh API password',
    ]))
    story.append(Paragraph('If you use docs/install-itms-all-in-one.sh, the script writes both files for you from the environment variables you pass to it.', styles['BodySmall']))

    story.append(Paragraph('Required Files', styles['SectionHeading']))
    story.append(Paragraph('backend/.env', styles['SmallHeading']))
    story.append(code_block('BACKEND_ADDR=:3001\nPUBLIC_SERVER_URL=http://YOUR_SERVER_IP\nFRONTEND_ORIGIN=http://YOUR_SERVER_IP\nDEFAULT_ADMIN_EMAIL=admin@zerodha.com\nDEFAULT_ADMIN_NAME=ITMS Admin\nSALT_MASTER_HOST=YOUR_SERVER_IP\nWAZUH_MANAGER_HOST=YOUR_SERVER_IP'))
    story.append(Paragraph('backend/.env.secrets', styles['SmallHeading']))
    story.append(code_block('DEFAULT_ADMIN_PASSWORD=YOUR_STRONG_ADMIN_PASSWORD\nJWT_SECRET=YOUR_LONG_RANDOM_JWT_SECRET\nSALT_API_PASSWORD=YOUR_STRONG_SALT_PASSWORD\nWAZUH_API_PASSWORD=YOUR_STRONG_WAZUH_PASSWORD'))
    story.append(Paragraph('Password policy', styles['SmallHeading']))
    story.append(bullet_list([
        'At least 12 characters',
        'At least one uppercase letter',
        'At least one lowercase letter',
        'At least one number',
        'At least one symbol',
    ]))

    story.append(Paragraph('Installation Commands', styles['SectionHeading']))
    sections = [
        ('1. Start backend and Postgres', 'cd /home/itms/itms\nbash scripts/install-docker-and-start-itms.sh --detach'),
        ('2. Verify stack health', 'cd /home/itms/itms\nbash scripts/verify-itms-stack.sh --sudo'),
        ('3. Publish frontend behind nginx', 'cd /home/itms/itms\nbash scripts/install-itms-nginx.sh YOUR_DOMAIN_OR_IP\nbash scripts/smoke-test-itms-nginx.sh --base-url http://YOUR_SERVER_IP'),
        ('4. Install security integrations', "cd /home/itms/itms\nsudo ITMS_ROOT=/home/itms/itms \\\n  SALT_API_PASSWORD='YOUR_STRONG_SALT_PASSWORD' \\\n  WAZUH_API_PASSWORD='YOUR_STRONG_WAZUH_PASSWORD' \\\n  bash scripts/install-itms-server-integrations.sh"),
        ('5. Reload backend configuration', 'cd /home/itms/itms\ndocker compose -f backend/docker-compose.yml up -d --force-recreate backend'),
        ('6. Install ClamAV for full verification', 'apt-get update\napt-get install -y clamav clamav-daemon || true'),
    ]
    for heading, body in sections:
        story.append(Paragraph(heading, styles['SmallHeading']))
        story.append(code_block(body))

    story.append(Paragraph('Validation Commands', styles['SectionHeading']))
    story.append(code_block('cd /home/itms/itms\nbash scripts/smoke-test-itms-api.sh\nbash scripts/verify-itms-security-integrations.sh --wazuh-agent-id 000'))
    story.append(Paragraph('Expected result: both scripts complete successfully, with SSH checks skipped if the SSH terminal is intentionally not configured.', styles['BodySmall']))

    story.append(Paragraph('Admin Password Recovery', styles['SectionHeading']))
    story.append(Paragraph('If the database already existed and the env password changed later, the admin password must be synced explicitly.', styles['BodySmall']))
    story.append(code_block("cd /home/itms/itms/backend\ndocker run --rm \\\n  --network backend_default \\\n  -v \"$PWD\":/src \\\n  -w /src \\\n  --env-file .env \\\n  --env-file .env.secrets \\\n  -e 'DATABASE_URL=postgres://postgres:postgres@postgres:5432/itms?sslmode=disable' \\\n  golang:1.23 \\\n  /usr/local/go/bin/go run ./cmd/sync_default_admin_password"))
    story.append(Paragraph('Expected output: Updated password hash for admin@zerodha.com.', styles['BodySmall']))

    story.append(Paragraph('API Login Test', styles['SectionHeading']))
    story.append(code_block("curl -sS -X POST http://127.0.0.1:3001/api/auth/login \\\n  -H 'Content-Type: application/json' \\\n  --data '{\"email\":\"admin@zerodha.com\",\"password\":\"YOUR_STRONG_ADMIN_PASSWORD\"}'"))
    story.append(Paragraph('Expected result: a JSON payload with token and a super_admin user object.', styles['BodySmall']))

    story.append(PageBreak())
    story.append(Paragraph('Todo Checklist', styles['SectionHeading']))
    table_rows = [
        ['#', 'Task', 'Done when'],
        ['1', 'Clone repo into /home/itms/itms', 'Repo files are present on the server'],
        ['2', 'Install git, curl, and Node.js 22+', 'The host can clone the repo and build the frontend'],
        ['3', 'Create backend/.env.secrets', 'Strong secrets are set before first startup'],
        ['4', 'Create backend/.env', 'Server IP or domain and admin values are set'],
        ['5', 'Run Docker installer', 'Backend and Postgres containers are healthy'],
        ['6', 'Deploy nginx frontend', 'Login page opens on the target IP or domain'],
        ['7', 'Install Salt, Wazuh, OpenSCAP', 'Host services are running and backend env updated'],
        ['8', 'Install ClamAV', 'Security verification can include ClamAV'],
        ['9', 'Run smoke test', 'Core API checks complete successfully'],
        ['10', 'Run security verification', 'Salt, Wazuh, ClamAV, and OpenSCAP verify successfully'],
        ['11', 'Log in as admin', 'UI or API login works for admin@zerodha.com'],
    ]
    table = Table(table_rows, colWidths=[12 * mm, 60 * mm, 108 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f7')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#13212b')),
        ('FONTNAME', (0, 0), (-1, 0), 'Times-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'Times-Roman'),
        ('FONTSIZE', (0, 0), (-1, -1), 9.2),
        ('LEADING', (0, 0), (-1, -1), 11),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d6dde2')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(table)
    story.append(Spacer(1, 10))
    story.append(Paragraph('Generated from the current repo workflow on June 8, 2026. Source scripts: scripts/install-docker-and-start-itms.sh, scripts/install-itms-nginx.sh, scripts/install-itms-server-integrations.sh, scripts/smoke-test-itms-api.sh, scripts/verify-itms-security-integrations.sh.', styles['Italic']))
    return story


def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont('Times-Roman', 9)
    canvas.setFillColor(colors.HexColor('#5b6b73'))
    canvas.drawRightString(195 * mm, 10 * mm, f'Page {doc.page}')
    canvas.restoreState()


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=14 * mm,
        leftMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=16 * mm,
        title='ITMS New Server Installation Guide',
        author='GitHub Copilot',
    )
    doc.build(build_story(), onFirstPage=add_page_number, onLaterPages=add_page_number)
    print(OUTPUT)


if __name__ == '__main__':
    main()
