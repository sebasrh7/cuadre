// Factura electrónica SINTÉTICA. Sigue la estructura UBL 2.1 del anexo técnico
// de la DIAN (contenedor AttachedDocument con la factura como CDATA), pero
// todos los nombres, NIT, números y montos son inventados.
// Nunca agregar datos reales.

export interface DianFixture {
  number?: string;
  cufe?: string;
  issuedOn?: string;
  issuerNit?: string;
  issuerName?: string;
  /** Como lo escribe el XML: decimal con punto. */
  total?: string;
  currency?: string;
  /** Raíz del documento: factura o nota. */
  root?: "Invoice" | "CreditNote";
}

/** CUFE sintético: 96 caracteres hexadecimales (SHA-384). */
export const fixtureCufe = (seed: string) => seed.repeat(96).slice(0, 96);

const NS =
  'xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" ' +
  'xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"';

/** La factura sola, como va dentro del contenedor. */
export function buildDianInvoiceXml({
  number = "FE1234",
  cufe = fixtureCufe("ab12"),
  issuedOn = "2026-12-05",
  issuerNit = "900123456",
  issuerName = "TIENDA EJEMPLO S.A.S.",
  total = "45900.00",
  currency = "COP",
  root = "Invoice",
}: DianFixture = {}): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<${root} xmlns="urn:oasis:names:specification:ubl:schema:xsd:${root}-2" ${NS}>
  <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>10</cbc:CustomizationID>
  <cbc:ProfileID>DIAN 2.1: Factura Electrónica de Venta</cbc:ProfileID>
  <cbc:ID>${number}</cbc:ID>
  <cbc:UUID schemeID="1" schemeName="CUFE-SHA384">${cufe}</cbc:UUID>
  <cbc:IssueDate>${issuedOn}</cbc:IssueDate>
  <cbc:IssueTime>10:00:00-05:00</cbc:IssueTime>
  <cbc:InvoiceTypeCode>01</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
  <cbc:LineCountNumeric>1</cbc:LineCountNumeric>
  <cac:AccountingSupplierParty>
    <cbc:AdditionalAccountID>1</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyName><cbc:Name>Tienda Ejemplo</cbc:Name></cac:PartyName>
      <cac:PartyTaxScheme>
        <cbc:RegistrationName>${issuerName.replace(/&/g, "&amp;")}</cbc:RegistrationName>
        <cbc:CompanyID schemeAgencyID="195" schemeID="7" schemeName="31">${issuerNit}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cbc:AdditionalAccountID>2</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyTaxScheme>
        <cbc:RegistrationName>TITULAR DE PRUEBA</cbc:RegistrationName>
        <cbc:CompanyID schemeAgencyID="195" schemeName="13">1000000010</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>ZZ</cbc:ID><cbc:Name>No aplica</cbc:Name></cac:TaxScheme>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">7328.57</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currency}">38571.43</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currency}">38571.43</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${total}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${currency}">${total}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="94">1.00</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${currency}">38571.43</cbc:LineExtensionAmount>
    <cac:Item><cbc:Description>Producto de prueba</cbc:Description></cac:Item>
  </cac:InvoiceLine>
</${root}>`;
}

/** El contenedor que llega por correo: la factura y la respuesta de la DIAN como CDATA. */
export function buildDianAttachedDocumentXml(fixture: DianFixture = {}): string {
  const { number = "FE1234", cufe = fixtureCufe("ab12"), issuedOn = "2026-12-05" } = fixture;
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<AttachedDocument xmlns="urn:oasis:names:specification:ubl:schema:xsd:AttachedDocument-2" ${NS}>
  <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>Documentos adjuntos</cbc:CustomizationID>
  <cbc:ProfileID>Factura Electrónica de Venta</cbc:ProfileID>
  <cbc:ID>9999</cbc:ID>
  <cbc:IssueDate>${issuedOn}</cbc:IssueDate>
  <cbc:DocumentType>Contenedor de Factura Electrónica</cbc:DocumentType>
  <cbc:ParentDocumentID>${number}</cbc:ParentDocumentID>
  <cac:SenderParty>
    <cac:PartyTaxScheme>
      <cbc:RegistrationName>NO ES EL DATO QUE SE LEE</cbc:RegistrationName>
      <cbc:CompanyID schemeAgencyID="195" schemeID="7" schemeName="31">800999999</cbc:CompanyID>
    </cac:PartyTaxScheme>
  </cac:SenderParty>
  <cac:Attachment>
    <cac:ExternalReference>
      <cbc:MimeCode>text/xml</cbc:MimeCode>
      <cbc:EncodingCode>UTF-8</cbc:EncodingCode>
      <cbc:Description><![CDATA[${buildDianInvoiceXml(fixture)}]]></cbc:Description>
    </cac:ExternalReference>
  </cac:Attachment>
  <cac:ParentDocumentLineReference>
    <cbc:LineID>1</cbc:LineID>
    <cac:DocumentReference>
      <cbc:ID>${number}</cbc:ID>
      <cbc:UUID schemeName="CUFE-SHA384">${cufe}</cbc:UUID>
      <cbc:IssueDate>${issuedOn}</cbc:IssueDate>
      <cbc:DocumentType>ApplicationResponse</cbc:DocumentType>
      <cac:Attachment>
        <cac:ExternalReference>
          <cbc:MimeCode>text/xml</cbc:MimeCode>
          <cbc:EncodingCode>UTF-8</cbc:EncodingCode>
          <cbc:Description><![CDATA[<?xml version="1.0" encoding="utf-8"?><ApplicationResponse xmlns="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2" ${NS}><cbc:ID>1</cbc:ID><cbc:UUID>${fixtureCufe("ff00")}</cbc:UUID></ApplicationResponse>]]></cbc:Description>
        </cac:ExternalReference>
      </cac:Attachment>
      <cac:ResultOfVerification>
        <cbc:ValidatorID>Unidad Especial Dirección de Impuestos y Aduanas Nacionales</cbc:ValidatorID>
        <cbc:ValidationResultCode>02</cbc:ValidationResultCode>
        <cbc:ValidationDate>${issuedOn}</cbc:ValidationDate>
      </cac:ResultOfVerification>
    </cac:DocumentReference>
  </cac:ParentDocumentLineReference>
</AttachedDocument>`;
}
