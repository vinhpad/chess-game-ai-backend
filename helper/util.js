export function validadeUsername(username) {
    const reg = /[a-zA-Z0-9]+/
    return reg.test(username) && username.length >= 4 && username.length <= 20
}

export function validadePassword(password) {
    return password.length >= 6 && password.length <= 30
}

export function validadeEmail(email) {
    const reg = /\S+@\S+\.\S+/
    return reg.test(email)
}

