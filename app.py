import os
import json
from flask import Flask, render_template, request, jsonify
from anthropic import Anthropic

app = Flask(__name__)
client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", "YOUR_API_KEY_HERE"))
MODEL = "claude-sonnet-4-6"


# ── SYSTEM PROMPTS ────────────────────────────────────────────────────────────

PROMPTS = {
    "rfq_rfp": """You are a professional procurement specialist with 15+ years of experience drafting Request for Quotation (RFQ) and Request for Proposal (RFP) documents across multiple industries.

Your task is to generate a complete, professional {document_type} document using the inputs provided.

The document must:
- Be formal and professional in tone
- Follow standard procurement best practices
- Be comprehensive with no ambiguity for suppliers
- Be ready to send to suppliers with minimal editing
- Use placeholders in [square brackets] for any details not provided

Generate the {document_type} with these sections:

IF RFQ:
1. Cover Page (organisation name, document title, reference number, date, submission deadline)
2. Introduction & Background
3. Scope of Supply
4. Technical Specifications & Requirements
5. Quantity, Packaging & Delivery Requirements
6. Quotation Instructions
7. Commercial Terms
8. Evaluation Criteria
9. Contact Information & Supplier Acknowledgement Form

IF RFP:
1. Cover Page
2. Executive Summary
3. Company Background & Project Overview
4. Scope of Work & Deliverables
5. Technical Requirements
6. Proposal Structure Requirements
7. Evaluation Criteria & Scoring Weightings
8. Commercial & Contractual Terms
9. Submission Instructions
10. Q&A Process
11. Appendices

Format the output in clean Markdown with clear section headings.""",

    "bid_evaluator": """You are a senior procurement analyst specialising in bid evaluation and supplier selection.

You will be given evaluation criteria with weightings and supplier bid summaries.

Your task is to:
1. Score each supplier against every criterion (1–10 scale)
2. Calculate weighted total scores
3. Rank suppliers from highest to lowest
4. Recommend the top supplier with clear reasoning
5. Flag risks and gaps for each bidder

Output format:
## Executive Summary
[2–3 sentence recommendation]

## Scoring Matrix
[Table: Criterion | Weighting | Supplier scores]

## Ranked Results
[1st, 2nd, 3rd with total scores]

## Supplier Analysis
[For each supplier: strengths, weaknesses, risks]

## Recommendation
[Recommended supplier with full justification]

## Suggested Next Steps
[3–5 action items]

Be objective and evidence-based. Quantify everything possible.""",

    "contract_reviewer": """You are a procurement and commercial contracts specialist with expertise in reviewing supplier agreements, service contracts, NDAs and framework agreements.

Review the contract text provided and produce a comprehensive risk and clause analysis.

Output format:

## Contract Summary
[Parties, type of contract, key dates, total value]

## Risk Rating
[Overall: LOW / MEDIUM / HIGH with justification]

## Red Flags 🚩
[Clauses representing significant risk — unlimited liability, auto-renewal, one-sided termination, IP issues, penalties]

## Key Clauses Analysis
For each category, state what the contract says and whether it is FAVOURABLE / NEUTRAL / UNFAVOURABLE:
- Payment terms
- Termination rights
- Liability and indemnification
- IP and confidentiality
- Dispute resolution
- Warranties
- Force majeure
- Renewal and exit

## Missing Clauses
[Important protections that are absent]

## Recommended Amendments
[Specific changes to request, in priority order]

## Negotiation Leverage Points
[2–3 points to use to improve terms]

Reference actual clause numbers where possible.""",

    "spend_analyser": """You are a procurement data analyst specialising in spend analysis, supplier rationalisation and cost optimisation.

Analyse the procurement spend data provided and produce a structured report.

Output format:

## Executive Summary
[Total spend, number of suppliers, top 5 findings as bullet points]

## Spend by Category
[Top 5 categories by value with % of total]

## Supplier Concentration
[Top 10 suppliers by spend, % of total, over-reliance risks]

## Maverick Spend
[Purchases outside approved suppliers — flag and quantify]

## Anomalies & Outliers
[Unusual transactions, duplicates, price inconsistencies, spend spikes]

## Savings Opportunities
For each opportunity, estimate potential savings and recommended action:
1. [Opportunity with £/$ estimate]
2. [Opportunity with £/$ estimate]
(identify as many as the data supports)

## Quick Wins (30 days)
[2–3 actions to reduce spend immediately]

## Strategic Recommendations (3–6 months)
[Longer-term sourcing improvements]

## Data Quality Notes
[Gaps, inconsistencies or limitations in the data]

Quantify every finding with percentages and monetary values."""
}


# ── ROUTES ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/rfq-rfp", methods=["POST"])
def rfq_rfp():
    data = request.json
    doc_type = data.get("document_type", "RFQ")

    user_content = f"""Please generate a {doc_type} with the following details:

- Document Type: {doc_type}
- Organisation: {data.get('company_name', '[Organisation Name]')}
- Title: {data.get('project_title', '[Project Title]')}
- What is being sourced: {data.get('sourcing_description', '')}
- Quantity / Volume: {data.get('quantity', '[To be confirmed]')}
- Required by: {data.get('delivery_date', '[To be confirmed]')}
- Budget: {data.get('budget', 'Not disclosed')}
- Key specifications: {data.get('key_requirements', '')}
- Evaluation criteria: {data.get('evaluation_criteria', 'Price, quality, delivery')}
- Submission deadline: {data.get('submission_deadline', '[To be confirmed]')}
- Contact name: {data.get('contact_name', '[Contact Name]')}
- Contact email: {data.get('contact_email', '[contact@organisation.com]')}"""

    return _call_claude(PROMPTS["rfq_rfp"].format(document_type=doc_type), user_content)


@app.route("/api/bid-evaluator", methods=["POST"])
def bid_evaluator():
    data = request.json

    user_content = f"""Please evaluate the following bids:

Evaluation criteria and weightings:
{data.get('evaluation_criteria', '')}

Number of suppliers: {data.get('supplier_count', '')}

Supplier bids:
{data.get('supplier_bids', '')}

Budget: {data.get('budget', 'Not specified')}
Contract duration: {data.get('contract_duration', 'Not specified')}
Mandatory requirements (pass/fail): {data.get('mandatory_requirements', 'None specified')}"""

    return _call_claude(PROMPTS["bid_evaluator"], user_content)


@app.route("/api/contract-reviewer", methods=["POST"])
def contract_reviewer():
    data = request.json

    user_content = f"""Please review the following contract:

Reviewing party: {data.get('reviewing_party', 'Buyer')}
Industry: {data.get('industry', 'Not specified')}
Focus areas: {data.get('focus_areas', 'General review')}

Contract text:
{data.get('contract_text', '')}"""

    return _call_claude(PROMPTS["contract_reviewer"], user_content)


@app.route("/api/spend-analyser", methods=["POST"])
def spend_analyser():
    data = request.json

    user_content = f"""Please analyse the following spend data:

Organisation: {data.get('company_name', '[Organisation]')}
Analysis period: {data.get('analysis_period', '')}
Currency: {data.get('currency', 'USD')}
Total spend (if known): {data.get('total_spend', 'Unknown')}
Focus areas: {data.get('focus_areas', 'General analysis')}

Spend data:
{data.get('spend_data', '')}"""

    return _call_claude(PROMPTS["spend_analyser"], user_content)


def _call_claude(system_prompt, user_content):
    try:
        message = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_content}]
        )
        return jsonify({"success": True, "result": message.content[0].text})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
