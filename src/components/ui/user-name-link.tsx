import { Link, useLocation } from "react-router-dom";
import { formatUserName, formatFullName } from "@/lib/utils.ts";

type UserNameLinkProps = {
  /** User ID for the link */
  userId?: string | null;
  /** First name */
  firstName?: string | null;
  /** Middle name (optional) */
  middleName?: string | null;
  /** Last name */
  lastName?: string | null;
  /** Full name (alternative to firstName/middleName/lastName) */
  fullName?: string | null;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show as plain text (no link) */
  asText?: boolean;
  /** Custom link path (default: /bg/admin/user/{userId}) */
  linkPath?: string;
  /** Whether to pass current URL as return URL in state */
  preserveReturnUrl?: boolean;
};

/**
 * Displays a user name formatted as "Име П. Фамилия" with an optional link to their profile
 */
export function UserNameLink({
  userId,
  firstName,
  middleName,
  lastName,
  fullName,
  className = "",
  asText = false,
  linkPath,
  preserveReturnUrl = true,
}: UserNameLinkProps) {
  const location = useLocation();
  
  // Format the name
  const formattedName = fullName
    ? formatFullName(fullName)
    : formatUserName(firstName, middleName, lastName);

  // If no userId or asText is true, render as plain text
  if (!userId || asText) {
    return <span className={className}>{formattedName}</span>;
  }

  // Default link path
  const href = linkPath || `/bg/admin/user/${userId}`;
  
  // Build state with return URL
  const linkState = preserveReturnUrl 
    ? { returnUrl: location.pathname + location.search }
    : undefined;

  return (
    <Link
      to={href}
      state={linkState}
      className={`text-primary hover:underline cursor-pointer ${className}`}
    >
      {formattedName}
    </Link>
  );
}

export default UserNameLink;
