from reportlab.platypus import *
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.units import cm

# ==========================================
# CONFIG
# ==========================================

PDF_NAME = "NoorLabs_Premium_Catalogue_2025.pdf"

PRIMARY = colors.HexColor("#7C3AED")
SECONDARY = colors.HexColor("#A855F7")
GOLD = colors.HexColor("#F59E0B")

# Images
COVER_IMAGE = "fullservices.png"
WEBSITE_IMAGE = "website.png"
ERP_IMAGE = "erp-.png"
REPORT_IMAGE = "erp-report-automation.png"
AUTOMATION_IMAGE = "erp-report-automation-sender.png"
END_IMAGE = "end.png"

# Contact Information
COMPANY = "NOOR LABS"
WEBSITE = "www.noorlabs.com"
EMAIL = "hello@noorlabs.com"
PHONE = "+212 6 XX XX XX XX"
LOCATION = "Morocco"

# ==========================================
# PDF
# ==========================================

doc = SimpleDocTemplate(
    PDF_NAME,
    pagesize=A4,
    rightMargin=40,
    leftMargin=40,
    topMargin=40,
    bottomMargin=40
)

styles = getSampleStyleSheet()

title = ParagraphStyle(
    "title",
    parent=styles["Heading1"],
    fontSize=24,
    textColor=PRIMARY,
    alignment=TA_CENTER,
    spaceAfter=20
)

subtitle = ParagraphStyle(
    "subtitle",
    parent=styles["Heading2"],
    fontSize=14,
    textColor=SECONDARY,
    alignment=TA_CENTER
)

heading = ParagraphStyle(
    "heading",
    parent=styles["Heading2"],
    textColor=PRIMARY,
    spaceBefore=10,
    spaceAfter=10
)

body = ParagraphStyle(
    "body",
    parent=styles["BodyText"],
    fontSize=11,
    leading=18
)

story = []

# ==========================================
# HELPER
# ==========================================

def add_full_image(path, width=16*cm):
    img = Image(path)
    img.drawWidth = width
    img.drawHeight = img.imageHeight * width / img.imageWidth
    story.append(img)
    story.append(Spacer(1, 12))

def service_section(
    title_text,
    price,
    intro,
    benefits,
    image_path
):

    story.append(Paragraph(title_text, heading))

    story.append(
        Paragraph(
            f"<b>Investment:</b> {price}",
            body
        )
    )

    story.append(Spacer(1,8))

    story.append(
        Paragraph(
            intro,
            body
        )
    )

    story.append(Spacer(1,8))

    story.append(
        Paragraph(
            "<b>Key Benefits</b>",
            body
        )
    )

    for item in benefits:
        story.append(
            Paragraph(
                f"• {item}",
                body
            )
        )

    story.append(Spacer(1,15))

    add_full_image(image_path)

    story.append(PageBreak())

# ==========================================
# COVER
# ==========================================

story.append(Spacer(1, 80))

story.append(
    Paragraph(
        COMPANY,
        title
    )
)

story.append(
    Paragraph(
        "Digital Solutions Catalogue 2025",
        subtitle
    )
)

story.append(Spacer(1,20))

add_full_image(COVER_IMAGE)

story.append(PageBreak())

# ==========================================
# EXECUTIVE SUMMARY
# ==========================================

story.append(
    Paragraph(
        "Executive Summary",
        heading
    )
)

story.append(
    Paragraph(
        """
        Noor Labs specializes in building digital solutions that
        help organizations improve productivity, automate operations,
        and accelerate growth.

        Our services range from professional websites to advanced
        ERP and AI-powered automation systems.

        Every solution is tailored to the unique requirements
        of each business.
        """,
        body
    )
)

story.append(PageBreak())

# ==========================================
# WEBSITE
# ==========================================

service_section(
    "Professional Website",
    "3,000 DH",
    """
    A professional website is often the first impression
    customers have of your business.

    We create modern, responsive, and conversion-focused websites
    that strengthen your brand and help generate leads.
    """,
    [
        "Responsive design",
        "SEO optimization",
        "Fast loading speeds",
        "Professional UI/UX",
        "5 modifications per year",
        "1 year support"
    ],
    WEBSITE_IMAGE
)

# ==========================================
# ERP
# ==========================================

service_section(
    "Business ERP System",
    "5,000 DH",
    """
    Centralize your business operations inside a single platform.

    Manage inventory, customers, sales, finances, and operations
    through an ERP tailored to your industry.
    """,
    [
        "Inventory management",
        "Employee management",
        "Sales tracking",
        "Financial reporting",
        "Custom workflows",
        "3 modifications per year"
    ],
    ERP_IMAGE
)

# ==========================================
# REPORTING
# ==========================================

service_section(
    "ERP + Report Automation",
    "7,000 DH",
    """
    Transform data into actionable insights.

    Automated reporting and dashboards provide management
    with real-time visibility into business performance.
    """,
    [
        "Automated reports",
        "Business intelligence",
        "Dashboard analytics",
        "KPI tracking",
        "Decision support",
        "3 modifications per year"
    ],
    REPORT_IMAGE
)

# ==========================================
# AUTOMATION
# ==========================================

service_section(
    "ERP + Full Automation Suite",
    "10,000 DH",
    """
    The ultimate digital transformation package.

    Combine ERP, automation, AI analytics,
    automated communication, and workflow management.
    """,
    [
        "ERP system",
        "SMS automation",
        "Email automation",
        "AI analytics",
        "Workflow automation",
        "3 modifications per year"
    ],
    AUTOMATION_IMAGE
)

# ==========================================
# COMPARISON TABLE
# ==========================================

story.append(
    Paragraph(
        "Package Comparison",
        heading
    )
)

table_data = [
    ["Package", "Price", "Ideal For"],
    ["Website", "3,000 DH", "Online Presence"],
    ["ERP", "5,000 DH", "Business Management"],
    ["ERP + Reports", "7,000 DH", "Data-Driven Companies"],
    ["Full Automation", "10,000 DH", "Scaling Businesses"],
]

table = Table(table_data, colWidths=[6*cm,3*cm,7*cm])

table.setStyle(TableStyle([
    ('BACKGROUND',(0,0),(-1,0),PRIMARY),
    ('TEXTCOLOR',(0,0),(-1,0),colors.white),
    ('GRID',(0,0),(-1,-1),1,colors.black),
    ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold')
]))

story.append(table)

story.append(PageBreak())

# ==========================================
# ROI PAGE
# ==========================================

story.append(
    Paragraph(
        "Business Impact & ROI",
        heading
    )
)

story.append(
    Paragraph(
        """
        Companies that adopt automation and ERP systems
        often reduce manual administrative work by dozens
        of hours per month.

        Better reporting enables faster decision-making,
        while automation improves customer satisfaction
        and operational efficiency.

        Investing in digital transformation creates
        long-term business value and scalability.
        """,
        body
    )
)

story.append(PageBreak())

# ==========================================
# WHY CHOOSE US
# ==========================================

story.append(
    Paragraph(
        "Why Choose Noor Labs?",
        heading
    )
)

story.append(
    Paragraph(
        """
        • Tailored solutions

        • Modern technologies

        • Long-term support

        • Scalable architecture

        • Business-focused approach

        • Reliable delivery
        """,
        body
    )
)

story.append(Spacer(1,15))

add_full_image(END_IMAGE)

story.append(PageBreak())

# ==========================================
# CONTACT
# ==========================================

story.append(
    Paragraph(
        "Let's Build Your Success Story",
        title
    )
)

story.append(
    Paragraph(
        f"""
        <b>{COMPANY}</b><br/><br/>

        Website: {WEBSITE}<br/>
        Email: {EMAIL}<br/>
        Phone: {PHONE}<br/>
        Location: {LOCATION}<br/><br/>

        We help businesses modernize operations,
        automate processes, and scale efficiently.
        """,
        body
    )
)

# ==========================================
# BUILD
# ==========================================

doc.build(story)

print("Catalogue Generated Successfully")
print(PDF_NAME)