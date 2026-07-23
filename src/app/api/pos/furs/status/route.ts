// API: GET /api/pos/furs/status - fiskalni status (država, DDV, konfiguracija)
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getFiscalConfig, isFiscalConfigured, getFiscalLabels, getVatRate, VAT_RATES, validateTaxNumber } from '@/lib/furs'

export async function GET() {
  const auth = await requireAuth(['admin', 'cashier'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const config = getFiscalConfig()
    const configured = isFiscalConfigured()
    const labels = getFiscalLabels(config?.country || 'NONE')

    return NextResponse.json({
      configured,
      country: config?.country || 'NONE',
      countryName: labels.countryName,
      zoiLabel: labels.zoiLabel,
      eorLabel: labels.eorLabel,
      qrLabel: labels.qrLabel,
      taxNumber: config?.taxNumber || null,
      premiseId: config?.premiseId || null,
      electronicDeviceId: config?.electronicDeviceId || null,
      testMode: config?.testMode || false,
      vatRates: config ? VAT_RATES[config.country] : VAT_RATES.NONE,
      currentVatRate: config ? getVatRate(config.country, 'standard') : 0.22,
      // Validacije
      taxNumberValid: config ? validateTaxNumber(config.taxNumber, config.country) : false,
      // Navodila za konfiguracijo
      instructions: {
        SI: {
          name: 'Slovenija (FURS)',
          envVars: ['FISCAL_COUNTRY=SI', 'FISCAL_TAX_NUMBER=12345678', 'FISCAL_PREMISE_ID=1', 'FISCAL_DEVICE_ID=POS1'],
          vatRates: '22% (splošna), 9.5% (znižana), 5% (nizka)',
          notes: 'V produkciji potrebujete digitalno potrdilo (certifikat) za FURS SOAP API.',
        },
        HR: {
          name: 'Hrvaška (CIS/FINA)',
          envVars: ['FISCAL_COUNTRY=HR', 'FISCAL_TAX_NUMBER=12345678901', 'FISCAL_PREMISE_ID=1', 'FISCAL_DEVICE_ID=POS1'],
          vatRates: '25% (splošna), 13% (znižana), 5% (nizka)',
          notes: 'V produkciji potrebujete FINA certifikat za CIS SOAP API.',
        },
        AT: {
          name: 'Avstrija (RKV/Beleg)',
          envVars: ['FISCAL_COUNTRY=AT', 'FISCAL_TAX_NUMBER=U12345678', 'FISCAL_PREMISE_ID=1', 'FISCAL_DEVICE_ID=POS1'],
          vatRates: '20% (splošna), 10% (znižana), 5% (nizka)',
          notes: 'V produkciji potrebujete RKV-Beleg registracijo pri FinanzOnline.',
        },
        IT: {
          name: 'Italija (SDI/FatturaPA)',
          envVars: ['FISCAL_COUNTRY=IT', 'FISCAL_TAX_NUMBER=12345678901', 'FISCAL_PREMISE_ID=1', 'FISCAL_DEVICE_ID=POS1'],
          vatRates: '22% (splošna), 10% (znižana), 5% (nizka)',
          notes: 'V produkciji potrebujete SDI certifikat za FatturaPA XML.',
        },
        DE: {
          name: 'Nemčija (TSE/DSFinV-K)',
          envVars: ['FISCAL_COUNTRY=DE', 'FISCAL_TAX_NUMBER=12345678901', 'FISCAL_PREMISE_ID=1', 'FISCAL_DEVICE_ID=POS1'],
          vatRates: '19% (splošna), 7% (znižana), 5% (nizka)',
          notes: 'V produkciji potrebujete TSE (Technische Sicherheitseinrichtung) modul.',
        },
        HU: {
          name: 'Madžarska (NAV/Online Számla)',
          envVars: ['FISCAL_COUNTRY=HU', 'FISCAL_TAX_NUMBER=12345678-2-01', 'FISCAL_PREMISE_ID=1', 'FISCAL_DEVICE_ID=POS1'],
          vatRates: '27% (splošna), 18% (znižana), 5% (nizka)',
          notes: 'V produkciji potrebujete NAV (National Tax Authority) XML API.',
        },
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
