import React, { useContext } from "react";

import Context from "../../Context";
import StepProgress from "../StepProgress";

import styles from "./index.module.css";

interface HeaderProps {
  onContinue?: () => void;
}

const Header = ({ onContinue }: HeaderProps) => {
  const { itemId, accessToken, userToken, userId, isItemAccess } = useContext(Context);

  const tokens = [
    { label: "item_id", value: itemId },
    { label: "access_token", value: accessToken },
    { label: "user_token", value: userToken },
    { label: "user_id", value: userId },
  ].filter((t) => t.value);

  return (
    <div className={styles.step} style={{ animation: "fadeSlideUp 0.45s ease-out both" }}>
      <StepProgress current={1} total={4} />

      <div className={styles.content}>
        {/* Success ring */}
        <div className={styles.successRing}>
          <div className={styles.successCircle}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <path
                d="M8 18.5l7 7 13-13"
                stroke="#34d399"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <h1 className={styles.title}>Account Connected</h1>
        <p className={styles.subtitle}>
          Your bank account has been securely linked to PlaidConnect.
        </p>


        <button className={styles.continueBtn} onClick={onContinue}>
          Set up my dashboard
          <span style={{ marginLeft: "0.8rem" }}>→</span>
        </button>
      </div>
    </div>
  );
};

Header.displayName = "Header";

export default Header;
