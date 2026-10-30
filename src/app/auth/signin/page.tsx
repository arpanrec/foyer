import SignIn from "@/app/auth/signin/sign-in";
import { getSignInProps } from "@/app/auth/signin/sign-in-props";

export default async function SignInPage() {
    return <SignIn {...await getSignInProps()} />;
}
