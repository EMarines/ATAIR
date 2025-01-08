export function toComaSep(number: string | number): string {
    return new Intl.NumberFormat('es-MX').format(Number(number));
}

export function toTele(tel: string) {
	try {
		const res1 = tel.slice(0, 3)
		const res2 = tel.slice(3, 6)
		const res3 = tel.slice(6, 10)
		return (`${res1} ${res2} ${res3}`)		
	} catch (error) {
		console.log(error);
	}
}

export function cleanNumber(numToClean: string) {
	try {
		const newNumber = numToClean.replaceAll(",", "").replaceAll(" ", "").replaceAll("-", "").replaceAll("(", "").replaceAll(")", "");
		return newNumber;
		
	} catch (error) {
		console.log(error);
	}
}

export function cleanName(nomToClean: string) {
	try {
		const newNomber = nomToClean.trim().toLowerCase();
		return newNomber;

	} catch (error) {
		console.log(error);
	}
}

export function removeAccents(str: string) {
	return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
