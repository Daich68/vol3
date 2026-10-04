// Shared by the login page and the onboarding guide, so both forms accept the same credentials
export const validatePassword = (password: string): boolean => {
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    return passwordRegex.test(password);
};

export const validateLogin = (login: string): boolean => {
    return login.length >= 5;
};

export const PASSWORD_HINT = "минимум 8 символов: латиница и цифры";
export const LOGIN_HINT = "минимум 5 символов";
