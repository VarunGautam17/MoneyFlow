from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from ...database import get_db
from ... import models, schemas

router = APIRouter()

@router.get("/{session_id}", response_model=schemas.UploadSession)
def get_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(models.UploadSession).filter(models.UploadSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@router.get("/{session_id}/transactions", response_model=List[schemas.Transaction])
def get_transactions(session_id: str, db: Session = Depends(get_db)):
    txns = db.query(models.Transaction).filter(models.Transaction.session_id == session_id).all()
    return txns

@router.get("/{session_id}/analytics", response_model=schemas.AnalysisResult)
def get_analytics(session_id: str, db: Session = Depends(get_db)):
    result = db.query(models.AnalysisResult).filter(models.AnalysisResult.session_id == session_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Analytics not found or not ready")
    return result

@router.get("/{session_id}/recurring", response_model=List[schemas.RecurringGroup])
def get_recurring_groups(session_id: str, db: Session = Depends(get_db)):
    groups = db.query(models.RecurringGroup).filter(models.RecurringGroup.session_id == session_id).all()
    return groups

@router.patch("/{session_id}/transactions/{txn_id}", response_model=schemas.Transaction)
def update_transaction_category(
    session_id: str,
    txn_id: str,
    payload: schemas.TransactionUpdate,
    db: Session = Depends(get_db)
):
    txn = db.query(models.Transaction).filter(
        models.Transaction.session_id == session_id,
        models.Transaction.id == txn_id
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    txn.category = payload.category
    txn.category_confidence = 1.0
    db.commit()
    
    # Recalculate metrics & recurring
    all_txns = db.query(models.Transaction).filter(models.Transaction.session_id == session_id).all()
    
    # Reset recurring relationships
    for t in all_txns:
        t.is_recurring = False
        t.recurring_group_id = None
        
    db.query(models.RecurringGroup).filter(models.RecurringGroup.session_id == session_id).delete()
    
    from ...pipeline.recurring import detect_recurring_groups
    recurring_groups = detect_recurring_groups(all_txns)
    
    for group in recurring_groups:
        db_group = models.RecurringGroup(
            id=group["id"],
            session_id=session_id,
            name=group["name"],
            typical_amount=group["typical_amount"],
            frequency=group["frequency"],
            confidence=group["confidence"],
            category=group["category"]
        )
        db.add(db_group)
        
    from ...pipeline.metrics import calculate_metrics
    metrics_data = calculate_metrics(all_txns, recurring_groups)
    
    analysis_result = db.query(models.AnalysisResult).filter(models.AnalysisResult.session_id == session_id).first()
    if analysis_result:
        analysis_result.metrics = metrics_data["metrics"]
        analysis_result.top_categories = metrics_data["top_categories"]
        analysis_result.biggest_transactions = metrics_data["biggest_transactions"]
        analysis_result.insights = metrics_data["insights"]
        analysis_result.generated_at = datetime.utcnow()
    else:
        analysis_result = models.AnalysisResult(
            session_id=session_id,
            metrics=metrics_data["metrics"],
            top_categories=metrics_data["top_categories"],
            biggest_transactions=metrics_data["biggest_transactions"],
            insights=metrics_data["insights"]
        )
        db.add(analysis_result)
        
    db.commit()
    db.refresh(txn)
    return txn

@router.delete("/{session_id}")
def delete_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(models.UploadSession).filter(models.UploadSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"message": "Session deleted successfully"}

@router.get("/{session_id}/export", response_class=HTMLResponse)
def export_session_report(session_id: str, db: Session = Depends(get_db)):
    session = db.query(models.UploadSession).filter(models.UploadSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    txns = db.query(models.Transaction).filter(models.Transaction.session_id == session_id).all()
    analytics = db.query(models.AnalysisResult).filter(models.AnalysisResult.session_id == session_id).first()
    recurring = db.query(models.RecurringGroup).filter(models.RecurringGroup.session_id == session_id).all()
    
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>RupeeRadar Financial Report - {session.filename}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
            body {{
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                background-color: #fafafa;
                color: #1f2937;
                margin: 0;
                padding: 40px 20px;
            }}
            .container {{
                max-width: 900px;
                margin: 0 auto;
                background: white;
                padding: 40px;
                border-radius: 24px;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
                border: 1px solid #f3f4f6;
            }}
            .header {{
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 2px solid #f3f4f6;
                padding-bottom: 24px;
                margin-bottom: 32px;
            }}
            .logo {{
                font-weight: 800;
                font-size: 24px;
                color: #4f46e5;
                letter-spacing: -0.025em;
            }}
            .meta {{
                text-align: right;
                font-size: 13px;
                color: #6b7280;
            }}
            .title {{
                font-size: 28px;
                font-weight: 800;
                margin: 0 0 8px 0;
                letter-spacing: -0.025em;
                color: #111827;
            }}
            .metrics-grid {{
                display: grid;
                grid-template-cols: repeat(3, 1fr);
                gap: 20px;
                margin-bottom: 36px;
            }}
            .metric-card {{
                padding: 24px;
                border-radius: 16px;
                background-color: #f9fafb;
                border: 1px solid #f3f4f6;
            }}
            .metric-label {{
                font-size: 12px;
                font-weight: 600;
                color: #6b7280;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }}
            .metric-value {{
                font-size: 24px;
                font-weight: 800;
                margin-top: 8px;
            }}
            .metric-value.income {{ color: #10b981; }}
            .metric-value.spend {{ color: #ef4444; }}
            .metric-value.savings {{ color: #4f46e5; }}
            .section {{
                margin-bottom: 40px;
            }}
            .section-title {{
                font-size: 18px;
                font-weight: 700;
                border-bottom: 1px solid #e5e7eb;
                padding-bottom: 8px;
                margin-bottom: 16px;
                color: #111827;
            }}
            .insight-list {{
                list-style-type: none;
                padding: 0;
                margin: 0;
            }}
            .insight-item {{
                padding: 16px;
                background-color: #f5f3ff;
                border-left: 4px solid #8b5cf6;
                border-radius: 0 12px 12px 0;
                margin-bottom: 12px;
                font-size: 14px;
                font-weight: 500;
                color: #4c1d95;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin-top: 12px;
                font-size: 14px;
            }}
            th, td {{
                padding: 12px 16px;
                text-align: left;
                border-bottom: 1px solid #f3f4f6;
            }}
            th {{
                background-color: #f9fafb;
                font-weight: 600;
                color: #4b5563;
                text-transform: uppercase;
                font-size: 11px;
                letter-spacing: 0.05em;
            }}
            .text-right {{
                text-align: right;
            }}
            .badge {{
                display: inline-block;
                padding: 2px 8px;
                border-radius: 9999px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
            }}
            .badge.debit {{
                background-color: #fee2e2;
                color: #991b1b;
            }}
            .badge.credit {{
                background-color: #d1fae5;
                color: #065f46;
            }}
            .btn-print {{
                display: inline-flex;
                align-items: center;
                background-color: #4f46e5;
                color: white;
                padding: 10px 18px;
                border-radius: 10px;
                text-decoration: none;
                font-size: 14px;
                font-weight: 600;
                border: none;
                cursor: pointer;
                box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);
                margin-bottom: 24px;
            }}
            .btn-print:hover {{
                background-color: #4338ca;
            }}
            @media print {{
                body {{
                    background-color: white;
                    padding: 0;
                }}
                .container {{
                    box-shadow: none;
                    border: none;
                    padding: 0;
                    max-width: 100%;
                }}
                .btn-print {{
                    display: none;
                }}
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <button class="btn-print" onclick="window.print()">
                <svg style="margin-right: 8px; vertical-align: middle;" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print / Save as PDF
            </button>
            <div class="header">
                <div>
                    <div class="logo">RupeeRadar</div>
                    <div class="meta" style="text-align: left; margin-top: 4px;">Statement Report</div>
                </div>
                <div class="meta">
                    <div><strong>File Name:</strong> {session.filename}</div>
                    <div><strong>Generated At:</strong> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}</div>
                </div>
            </div>

            <div class="title">Personal Finance Summary</div>
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 32px;">An analysis of your transactions to provide summary insights, recurring expenses, and categorization breakdown.</p>
    """
    
    if analytics:
        metrics = analytics.metrics
        income = metrics.get("income", 0.0)
        spend = metrics.get("spend", 0.0)
        savings = metrics.get("savings", 0.0)
        savings_rate = metrics.get("savings_rate", 0.0)
        
        html_content += f"""
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Total Inflow (Income)</div>
                    <div class="metric-value income">₹{income:,.2f}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Total Outflow (Spend)</div>
                    <div class="metric-value spend">₹{spend:,.2f}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Net Savings ({savings_rate:.1f}%)</div>
                    <div class="metric-value savings">₹{savings:,.2f}</div>
                </div>
            </div>
        """
        
        if analytics.insights:
            html_content += """
                <div class="section">
                    <div class="section-title">Key Smart Insights</div>
                    <ul class="insight-list">
            """
            for insight in analytics.insights:
                html_content += f'<li class="insight-item">{insight}</li>'
            html_content += """
                    </ul>
                </div>
            """
            
    if recurring:
        html_content += """
            <div class="section">
                <div class="section-title">Detected Recurring Outflows (EMIs / Subscriptions / SIPs)</div>
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Typical Amount</th>
                            <th>Frequency</th>
                            <th>Confidence</th>
                        </tr>
                    </thead>
                    <tbody>
        """
        for r in recurring:
            html_content += f"""
                <tr>
                    <td><strong>{r.name}</strong></td>
                    <td>₹{r.typical_amount:,.2f}</td>
                    <td><span class="badge credit" style="background-color: #e0e7ff; color: #3730a3;">{r.frequency}</span></td>
                    <td>{(r.confidence * 100):.0f}%</td>
                </tr>
            """
        html_content += """
                    </tbody>
                </table>
            </div>
        """
        
    html_content += """
        <div class="section">
            <div class="section-title">Transactions Ledger (Top 20 Outflows / Inflows)</div>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Category</th>
                        <th class="text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
    """
    
    sorted_txns = sorted(txns, key=lambda t: abs(t.amount), reverse=True)[:20]
    for t in sorted_txns:
        amount_class = "credit" if t.amount > 0 else "debit"
        sign = "+" if t.amount > 0 else "-"
        html_content += f"""
            <tr>
                <td style="white-space: nowrap; color: #4b5563;">{t.date}</td>
                <td>
                    <div style="font-weight: 500;">{t.description_clean or t.description_raw}</div>
                    <div style="font-size: 11px; color: #9ca3af;">{t.description_raw}</div>
                </td>
                <td><span class="badge" style="background-color: #f3f4f6; color: #4b5563; font-weight: 500;">{t.category or 'Other'}</span></td>
                <td class="text-right"><span class="badge {amount_class}">{sign} ₹{abs(t.amount):,.2f}</span></td>
            </tr>
        """
        
    html_content += """
                </tbody>
            </table>
        </div>
        <div style="text-align: center; margin-top: 60px; font-size: 11px; color: #9ca3af;">
            Generated by RupeeRadar personal finance dashboard.
        </div>
    </div>
</body>
</html>
    """
    return HTMLResponse(content=html_content, status_code=200)

