const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,20}$/; // 영문 + 숫자 반드시 포함, 길이 8~20자 (특수문자는 허용 X)

const validator = {};

validator.validateEmail = (email) => {
  return emailRegex.test(email);
};

validator.validatePassword = (password) => {
  return passwordRegex.test(password);
};

module.exports = validator;
