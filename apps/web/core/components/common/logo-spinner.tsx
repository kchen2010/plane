/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// assets
import LogoSpinnerDark from "@/app/assets/images/logo-spinner-dark.gif?url";
import LogoSpinnerLight from "@/app/assets/images/logo-spinner-light.gif?url";

export function LogoSpinner() {
  return (
    <div className="flex items-center justify-center">
      <img
        src={LogoSpinnerLight}
        alt="logo"
        className="logo-spinner__image logo-spinner__image--light h-6 w-auto object-contain sm:h-11"
      />
      <img
        src={LogoSpinnerDark}
        alt="logo"
        className="logo-spinner__image logo-spinner__image--dark h-6 w-auto object-contain sm:h-11"
      />
    </div>
  );
}
