import React, { useState, FormEvent } from "react";
import {loginRequest, regRequest} from "../../api/Login";
import "./Login.css";
import { useNavigate } from "react-router-dom";
import { Token } from "../../entity/Entity";
import {GetAuthors} from "../../requests/Api";
import { safeLocalStorage } from "../../utils/localStorage";
import { ScrollProgress } from "../../components/ScrollProgress/ScrollProgress";

export const Login: React.FC = () => {
    const [login, setLogin] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [msg, setMsg] = useState<string>("");
    const [isRegister, setIsRegister] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loginError, setLoginError] = useState<string>("");
    const [passwordError, setPasswordError] = useState<string>("");
    const navigate = useNavigate();

    const handleLogin = async (event: FormEvent) => {
        event.preventDefault();
        
        if (isLoading) return;
        
        setMsg("");
        setIsLoading(true);
        
        try {
            const token: Token = await loginRequest({ login, password });
            safeLocalStorage.clear();
            safeLocalStorage.setItem("accessToken", token.access);
            safeLocalStorage.setItem("ID", token._id);
            navigate(`/person?id=${token._id}`);
            return;
        } catch (error) {
            console.error("Login failed:", error);
            setMsg("не удалось зайти (если возникли проблемы, пишите на почту info@web-almanac.com)");
        } finally {
            setIsLoading(false);
        }
    };

    const validatePassword = (password: string): boolean => {
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
        return passwordRegex.test(password);
    };

    const validateLogin = (login: string): boolean => {
        const loginRegex = /^[A-Za-z\d\s]{5,}$/;
        return loginRegex.test(login);
    };

    const isLoginExist = async (login: string): Promise<boolean> => {
        try {
            const authors = await GetAuthors();
            return authors.some((author) => author.login === login);
        } catch (error) {
            console.error(error)
            return false;
        }
    };

    const handleLoginChange = (value: string) => {
        setLogin(value);
        setLoginError("");
        setMsg("");
        
        if (isRegister && value.length >= 5 && !validateLogin(value)) {
            setLoginError("логин должен состоять не менее чем из 5 символов и включать буквы");
        }
    };

    const handlePasswordChange = (value: string) => {
        setPassword(value);
        setPasswordError("");
        setMsg("");
        
        if (isRegister && value.length >= 8 && !validatePassword(value)) {
            setPasswordError("пароль должен состоять не менее чем из 8 символов и включать как буквы (латинского алфавита), так и цифры");
        }
    };

    const handleRegister = async (event: FormEvent) => {
        event.preventDefault();

        if (isLoading) return;

        setMsg("");
        setLoginError("");
        setPasswordError("");

        if (password !== confirmPassword) {
            setMsg("пароли не совпадают");
            return;
        }

        if (!validatePassword(password)) {
            setPasswordError(
                "пароль должен состоять не менее чем из 8 символов и включать как буквы (латинского алфавита), так и цифры. специальные символы не разрешены."
            );
            return;
        }
        
        if (!validateLogin(login)) {
            setLoginError(
                "логин должен состоять не менее чем из 5 символов и включать буквы"
            )
            return;
        }
        
        setIsLoading(true);
        
        try {
            let exist = await isLoginExist(login)
            if (exist) {
                setLoginError(
                    "попробуйте придумать другой логин, такой уже существует"
                )
                return;
            }
            
            let token = await regRequest({ login, password });
            safeLocalStorage.clear();
            safeLocalStorage.setItem("accessToken", token.access);
            safeLocalStorage.setItem("ID", token._id);
            navigate("/person");
            return;
        } catch (error) {
            console.error("Registration failed:", error);
            setMsg("не удалось завершить регистрацию");
        } finally {
            setIsLoading(false);
        }
    };

    const toggleMode = () => {
        setIsRegister(!isRegister);
        setMsg("");
        setLoginError("");
        setPasswordError("");
        setConfirmPassword("");
    };

    return (
        <div className={"login"}>
        <ScrollProgress />
        <div className="auth-container">
            <div className="auth-form" role="main" aria-labelledby="auth-title">
                <h2 id="auth-title">{isRegister ? "регистрация" : "вход"}</h2>
                <form onSubmit={isRegister ? handleRegister : handleLogin} noValidate>
                    <label htmlFor="login-input">
                        {isRegister ? "ник (так вы будете отображаться на площадке):" : "ник:"}
                    </label>
                    <input
                        id="login-input"
                        className={"auth-input"}
                        type="text"
                        value={login}
                        onChange={(e) => handleLoginChange(e.target.value)}
                        required
                        aria-required="true"
                        aria-invalid={!!loginError}
                        aria-describedby={loginError ? "login-error" : undefined}
                        disabled={isLoading}
                        autoComplete="username"
                    />
                    {loginError && (
                        <p id="login-error" className="error-message" role="alert">
                            {loginError}
                        </p>
                    )}
                    
                    <label htmlFor="password-input">
                        пароль:
                    </label>
                    <input
                        id="password-input"
                        className={"auth-input"}
                        type="password"
                        value={password}
                        onChange={(e) => handlePasswordChange(e.target.value)}
                        required
                        aria-required="true"
                        aria-invalid={!!passwordError}
                        aria-describedby={passwordError ? "password-error" : undefined}
                        disabled={isLoading}
                        autoComplete={isRegister ? "new-password" : "current-password"}
                    />
                    {passwordError && (
                        <p id="password-error" className="error-message" role="alert">
                            {passwordError}
                        </p>
                    )}
                    
                    {isRegister && (
                        <>
                            <label htmlFor="confirm-password-input">
                                пароль еще раз:
                            </label>
                            <input
                                id="confirm-password-input"
                                className={"auth-input"}
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => {
                                    setConfirmPassword(e.target.value);
                                    setMsg("");
                                }}
                                required
                                aria-required="true"
                                disabled={isLoading}
                                autoComplete="new-password"
                            />
                        </>
                    )}
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        aria-busy={isLoading}
                    >
                        {isLoading ? "загрузка..." : (isRegister ? "регистрация" : "вход")}
                    </button>
                </form>
                {msg && <p className="auth-message" role="alert">{msg}</p>}
                <p className="switch-link">
                    {isRegister ? "уже есть аккаунт?" : "еще нет аккаунта?"}{" "}
                    <button 
                        className={"here"} 
                        onClick={toggleMode}
                        type="button"
                        disabled={isLoading}
                    >
                        {isRegister ?  "войти здесь" : "зарегестрироваться здесь"}
                    </button>
                </p>
            </div>
        </div>
        </div>
    );
};
