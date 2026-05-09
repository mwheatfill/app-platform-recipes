import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

interface EmailLayoutProps {
  preview: string;
  children: ReactNode;
  /** Brand color for the top accent bar — default Microsoft blue */
  accentColor?: string;
  /** Footer text shown after the main content */
  footer?: ReactNode;
}

/**
 * Shared shell for transactional emails. Customize colors/fonts to match your app.
 *
 * Renders to Outlook-compatible HTML via @react-email/render. Uses table-based layout under
 * the hood (React Email handles the dirty work).
 */
export function EmailLayout({
  preview,
  children,
  accentColor = "#0F6CBD",
  footer,
}: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={{ ...accentStyle, backgroundColor: accentColor }} />
          <Section style={contentStyle}>{children}</Section>
          {footer && (
            <>
              <Hr style={hrStyle} />
              <Section style={footerStyle}>
                <Text style={footerTextStyle}>{footer}</Text>
              </Section>
            </>
          )}
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle = {
  backgroundColor: "#f6f6f6",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: 0,
};

const containerStyle = {
  margin: "0 auto",
  padding: 0,
  maxWidth: "600px",
  backgroundColor: "#ffffff",
};

const accentStyle = {
  height: "4px",
  width: "100%",
};

const contentStyle = {
  padding: "32px",
};

const hrStyle = {
  borderColor: "#e5e7eb",
  margin: "0 32px",
};

const footerStyle = {
  padding: "24px 32px",
};

const footerTextStyle = {
  color: "#6b7280",
  fontSize: "12px",
  lineHeight: "20px",
  margin: 0,
};
