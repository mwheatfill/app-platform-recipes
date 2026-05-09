import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailLayout } from "./components/EmailLayout.js";

interface WelcomeEmailProps {
  recipientName: string;
  appName: string;
  appUrl: string;
}

/**
 * Sample template — copy this for new emails. Each template:
 *   1. Accepts typed props
 *   2. Wraps content in <EmailLayout> for shared shell
 *   3. Uses @react-email/components — they render to Outlook-compatible HTML
 */
export function WelcomeEmail({ recipientName, appName, appUrl }: WelcomeEmailProps) {
  return (
    <EmailLayout
      preview={`Welcome to ${appName}`}
      footer={`This is an automated message from ${appName}. Reply to this email if you need help.`}
    >
      <Heading style={headingStyle}>Welcome, {recipientName}</Heading>
      <Text style={textStyle}>
        Your access to {appName} is ready. Click below to sign in for the first time.
      </Text>
      <Section style={buttonContainerStyle}>
        <Button href={appUrl} style={buttonStyle}>
          Open {appName}
        </Button>
      </Section>
      <Text style={textStyle}>
        If the button doesn't work, copy this link into your browser:{" "}
        <a href={appUrl} style={linkStyle}>
          {appUrl}
        </a>
      </Text>
    </EmailLayout>
  );
}

const headingStyle = {
  color: "#111827",
  fontSize: "24px",
  fontWeight: 600,
  marginBottom: "16px",
};

const textStyle = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "22px",
};

const buttonContainerStyle = {
  margin: "24px 0",
};

const buttonStyle = {
  backgroundColor: "#0F6CBD",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 500,
  padding: "10px 20px",
  textDecoration: "none",
};

const linkStyle = {
  color: "#0F6CBD",
};
