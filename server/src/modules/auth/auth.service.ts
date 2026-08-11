import { prisma } from "../../config/database.js";
import { verifyPassword } from "../../utils/password.js";
import { generateAccessToken } from "../../utils/jwt.js";

import type { LoginInput } from "./auth.schema.js";
import type { SafeUser } from "./auth.types.js";
import { userInfo } from "node:os";

export async function login(
  input: LoginInput,
): Promise<{ token: string; user: SafeUser }> {
    const user = await prisma.user.findUnique({
        where:{
            email: input.email,
        },
        include:{
            employee:{
                include:{
                    designation:true,
                },
            },
            roles:{
                include:{
                    role:true,
                },
            },
        },
    });
    if(!user){
        throw new Error("invaild email or password");
    }
    if(!user.isActive){
        throw new Error("invaild email or password");
    }

    const passwordValid = await verifyPassword(input.password,user.passwordHash);

    if(!passwordValid){
        throw new Error("invalid email or password");
    }

    const token = generateAccessToken(user.id);

    const safeUser:SafeUser = { 
        id: user.id,
        employeeId: user.employee.employeeId,
        email: user.email,
        employee:{
            name: user.employee.name,
            designation: user.employee.designation.name,
        },
        roles: user.roles.map((userRole)=> userRole.role.name),
    };

    return {
        token: token,
        user: safeUser,
    };

};
